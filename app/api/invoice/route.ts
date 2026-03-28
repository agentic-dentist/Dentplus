import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/invoices?patientId=X&clinicId=Y
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const clinicId  = searchParams.get('clinicId')

  if (!patientId || !clinicId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('invoices')
    .select(`
      id, invoice_number, status, notes,
      subtotal, insurance_amount, patient_amount, amount_paid, balance_due,
      due_date, created_by_name, created_at, updated_at,
      treatment_plan_id,
      invoice_items (
        id, description, procedure_code, tooth_number,
        fee, insurance_covers, patient_portion, sort_order
      ),
      invoice_payments (
        id, amount, method, reference, notes, paid_at
      )
    `)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data || [] })
}

// POST /api/invoices — create new invoice
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      clinicId, patientId, createdBy, createdByName,
      treatmentPlanId, items, notes, dueDate,
      insuranceAmount,
    } = body

    if (!clinicId || !patientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Generate invoice number
    const { count } = await db
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

    // Calculate totals
    const subtotal        = (items || []).reduce((s: number, i: any) => s + (parseFloat(i.fee) || 0), 0)
    const insAmt          = parseFloat(insuranceAmount) || 0
    const patientAmount   = Math.max(0, subtotal - insAmt)

    const { data: invoice, error: invError } = await db
      .from('invoices')
      .insert({
        clinic_id:        clinicId,
        patient_id:       patientId,
        created_by:       createdBy || null,
        created_by_name:  createdByName || null,
        treatment_plan_id: treatmentPlanId || null,
        invoice_number:   invoiceNumber,
        status:           'draft',
        notes:            notes || null,
        due_date:         dueDate || null,
        subtotal,
        insurance_amount: insAmt,
        patient_amount:   patientAmount,
        amount_paid:      0,
        balance_due:      patientAmount,
      })
      .select()
      .single()

    if (invError || !invoice) {
      return NextResponse.json({ error: invError?.message || 'Failed to create invoice' }, { status: 500 })
    }

    // Insert line items
    if (items && items.length > 0) {
      const rows = items.map((item: any, i: number) => {
        const fee      = parseFloat(item.fee) || 0
        const insCov   = parseFloat(item.insuranceCovers) || 0
        const patPor   = Math.max(0, fee - insCov)
        return {
          invoice_id:       invoice.id,
          clinic_id:        clinicId,
          patient_id:       patientId,
          description:      item.description || '',
          procedure_code:   item.procedureCode || null,
          tooth_number:     item.toothNumber || null,
          fee,
          insurance_covers: insCov,
          patient_portion:  patPor,
          sort_order:       i,
        }
      })
      await db.from('invoice_items').insert(rows)
    }

    // Re-fetch with items
    const { data: full } = await db
      .from('invoices')
      .select(`id, invoice_number, status, notes, subtotal, insurance_amount, patient_amount, amount_paid, balance_due, due_date, created_by_name, created_at, updated_at, treatment_plan_id, invoice_items(id, description, procedure_code, tooth_number, fee, insurance_covers, patient_portion, sort_order), invoice_payments(id, amount, method, reference, notes, paid_at)`)
      .eq('id', invoice.id)
      .single()

    return NextResponse.json({ invoice: full })
  } catch (err) {
    console.error('[INVOICES POST]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH /api/invoices — update status, record payment, or edit
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { invoiceId, clinicId, action } = body

    if (!invoiceId || !clinicId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = createServerClient()

    if (action === 'status') {
      const { data, error } = await db
        .from('invoices')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('clinic_id', clinicId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ invoice: data })
    }

    if (action === 'payment') {
      // Record a payment
      const amount = parseFloat(body.amount) || 0

      const { error: payError } = await db
        .from('invoice_payments')
        .insert({
          invoice_id: invoiceId,
          clinic_id:  clinicId,
          amount,
          method:     body.method || 'cash',
          reference:  body.reference || null,
          notes:      body.notes || null,
          paid_at:    new Date().toISOString(),
        })
      if (payError) return NextResponse.json({ error: payError.message }, { status: 500 })

      // Recalculate balance
      const { data: invoice } = await db
        .from('invoices')
        .select('patient_amount, amount_paid')
        .eq('id', invoiceId)
        .single()

      const newAmountPaid = (invoice?.amount_paid || 0) + amount
      const newBalance    = Math.max(0, (invoice?.patient_amount || 0) - newAmountPaid)
      const newStatus     = newBalance <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'sent'

      const { data: updated, error: updError } = await db
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalance,
          status:      newStatus,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .select()
        .single()
      if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })

      // Return full invoice with payments
      const { data: full } = await db
        .from('invoices')
        .select(`id, invoice_number, status, notes, subtotal, insurance_amount, patient_amount, amount_paid, balance_due, due_date, created_by_name, created_at, updated_at, treatment_plan_id, invoice_items(id, description, procedure_code, tooth_number, fee, insurance_covers, patient_portion, sort_order), invoice_payments(id, amount, method, reference, notes, paid_at)`)
        .eq('id', invoiceId)
        .single()

      return NextResponse.json({ invoice: full })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[INVOICES PATCH]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/invoices?invoiceId=X&clinicId=Y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')
  const clinicId  = searchParams.get('clinicId')

  if (!invoiceId || !clinicId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const db = createServerClient()
  await db.from('invoice_payments').delete().eq('invoice_id', invoiceId)
  await db.from('invoice_items').delete().eq('invoice_id', invoiceId)
  const { error } = await db.from('invoices').delete()
    .eq('id', invoiceId).eq('clinic_id', clinicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
