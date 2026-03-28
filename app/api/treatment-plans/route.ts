import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/treatment-plans?patientId=X&clinicId=Y
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const clinicId  = searchParams.get('clinicId')

  if (!patientId || !clinicId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('treatment_plans')
    .select(`
      id, status, title, notes, total_fee,
      patient_signature, patient_signed_at, signed_by_name,
      created_by_name, created_at, updated_at,
      treatment_plan_items (
        id, procedure_code, description, tooth_number,
        surface, fee, sort_order
      )
    `)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data || [] })
}

// POST /api/treatment-plans — create new plan
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clinicId, patientId, createdBy, createdByName, title, notes, items } = body

    if (!clinicId || !patientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Calculate total
    const totalFee = (items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.fee) || 0), 0)

    // Insert plan
    const { data: plan, error: planError } = await db
      .from('treatment_plans')
      .insert({
        clinic_id:       clinicId,
        patient_id:      patientId,
        created_by:      createdBy || null,
        created_by_name: createdByName || null,
        title:           title || 'Treatment Plan',
        notes:           notes || null,
        status:          'draft',
        total_fee:       totalFee,
      })
      .select()
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: planError?.message || 'Failed to create plan' }, { status: 500 })
    }

    // Insert line items
    if (items && items.length > 0) {
      const rows = items.map((item: any, i: number) => ({
        plan_id:        plan.id,
        clinic_id:      clinicId,
        patient_id:     patientId,
        procedure_code: item.procedureCode || '',
        description:    item.description || '',
        tooth_number:   item.toothNumber || null,
        surface:        item.surface || null,
        fee:            parseFloat(item.fee) || 0,
        sort_order:     i,
      }))

      const { error: itemError } = await db.from('treatment_plan_items').insert(rows)
      if (itemError) console.error('[TREATMENT PLAN ITEMS]', itemError)
    }

    // Re-fetch with items
    const { data: full } = await db
      .from('treatment_plans')
      .select(`id, status, title, notes, total_fee, patient_signature, patient_signed_at, signed_by_name, created_by_name, created_at, updated_at, treatment_plan_items(id, procedure_code, description, tooth_number, surface, fee, sort_order)`)
      .eq('id', plan.id)
      .single()

    return NextResponse.json({ plan: full })
  } catch (err) {
    console.error('[TREATMENT PLANS POST]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH /api/treatment-plans — update status, items, or capture signature
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { planId, clinicId, action, status, title, notes, items, signature, signedByName } = body

    if (!planId || !clinicId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = createServerClient()

    if (action === 'sign') {
      // Patient approval signature
      const { data, error } = await db
        .from('treatment_plans')
        .update({
          status:             'approved',
          patient_signature:  signature,
          patient_signed_at:  new Date().toISOString(),
          signed_by_name:     signedByName || null,
          updated_at:         new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ plan: data })
    }

    if (action === 'status') {
      const { data, error } = await db
        .from('treatment_plans')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', planId)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ plan: data })
    }

    if (action === 'update') {
      // Recalculate total
      const totalFee = (items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.fee) || 0), 0)

      const { error: planError } = await db
        .from('treatment_plans')
        .update({ title, notes, total_fee: totalFee, updated_at: new Date().toISOString() })
        .eq('id', planId)
        .eq('clinic_id', clinicId)

      if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })

      // Replace items
      await db.from('treatment_plan_items').delete().eq('plan_id', planId)

      if (items && items.length > 0) {
        const { data: plan } = await db.from('treatment_plans').select('patient_id').eq('id', planId).single()
        const rows = items.map((item: any, i: number) => ({
          plan_id:        planId,
          clinic_id:      clinicId,
          patient_id:     plan?.patient_id,
          procedure_code: item.procedureCode || '',
          description:    item.description || '',
          tooth_number:   item.toothNumber || null,
          surface:        item.surface || null,
          fee:            parseFloat(item.fee) || 0,
          sort_order:     i,
        }))
        await db.from('treatment_plan_items').insert(rows)
      }

      const { data: full } = await db
        .from('treatment_plans')
        .select(`id, status, title, notes, total_fee, patient_signature, patient_signed_at, signed_by_name, created_by_name, created_at, updated_at, treatment_plan_items(id, procedure_code, description, tooth_number, surface, fee, sort_order)`)
        .eq('id', planId)
        .single()

      return NextResponse.json({ plan: full })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[TREATMENT PLANS PATCH]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE /api/treatment-plans?planId=X&clinicId=Y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const planId   = searchParams.get('planId')
  const clinicId = searchParams.get('clinicId')

  if (!planId || !clinicId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const db = createServerClient()
  await db.from('treatment_plan_items').delete().eq('plan_id', planId)
  const { error } = await db.from('treatment_plans').delete().eq('id', planId).eq('clinic_id', clinicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
