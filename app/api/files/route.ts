import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'patient-files'

// GET /api/files?patientId=X&clinicId=Y
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const clinicId  = searchParams.get('clinicId')
  const fileId    = searchParams.get('fileId') // for signed URL

  if (!clinicId) return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })

  const db = createServerClient()

  // Get signed URL for a single file
  if (fileId) {
    const { data: file } = await db.from('patient_files').select('file_path').eq('id', fileId).single()
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(file.file_path, 3600)
    return NextResponse.json({ url: signed?.signedUrl })
  }

  if (!patientId) return NextResponse.json({ error: 'Missing patientId' }, { status: 400 })

  const { data, error } = await db
    .from('patient_files')
    .select('id, file_name, file_type, file_size, category, notes, uploaded_by_name, created_at, file_path')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ files: data || [] })
}

// POST /api/files — upload file
export async function POST(request: Request) {
  try {
    const formData   = await request.formData()
    const file       = formData.get('file') as File
    const clinicId   = formData.get('clinicId') as string
    const patientId  = formData.get('patientId') as string
    const category   = formData.get('category') as string || 'other'
    const notes      = formData.get('notes') as string || ''
    const uploadedBy = formData.get('uploadedBy') as string || ''
    const uploadedByName = formData.get('uploadedByName') as string || ''

    if (!file || !clinicId || !patientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()
    const ext      = file.name.split('.').pop()?.toLowerCase() || ''
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${clinicId}/${patientId}/${Date.now()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('[FILES UPLOAD]', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: record, error: dbError } = await db
      .from('patient_files')
      .insert({
        clinic_id:         clinicId,
        patient_id:        patientId,
        uploaded_by:       uploadedBy || null,
        uploaded_by_name:  uploadedByName || null,
        file_name:         file.name,
        file_path:         filePath,
        file_type:         file.type || ext,
        file_size:         file.size,
        category,
        notes: notes || null,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ file: record })
  } catch (err) {
    console.error('[FILES POST]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE /api/files?fileId=X&clinicId=Y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const fileId   = searchParams.get('fileId')
  const clinicId = searchParams.get('clinicId')

  if (!fileId || !clinicId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const db = createServerClient()
  const { data: file } = await db.from('patient_files').select('file_path').eq('id', fileId).eq('clinic_id', clinicId).single()
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.storage.from(BUCKET).remove([file.file_path])
  await db.from('patient_files').delete().eq('id', fileId).eq('clinic_id', clinicId)

  return NextResponse.json({ success: true })
}
