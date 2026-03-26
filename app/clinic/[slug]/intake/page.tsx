'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    title: 'Patient Intake Form',
    subtitle: 'Please complete all sections before your first visit.',
    steps: ['Identity', 'Insurance', 'Medical', 'Dental', 'Consents'],
    next: 'Continue',
    back: 'Back',
    submit: 'Submit for review',
    submitting: 'Submitting...',
    submitted_title: 'Form submitted!',
    submitted_sub: 'Our team will review your information and confirm your registration shortly.',
    lang_toggle: 'Français',

    // Identity
    identity_title: 'Identity & Contact',
    full_name: 'Full legal name',
    preferred_name: 'Preferred name (optional)',
    dob: 'Date of birth',
    gender: 'Gender',
    gender_opts: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
    language: 'Preferred language',
    address: 'Street address',
    address2: 'Apt / Suite (optional)',
    city: 'City',
    province: 'Province',
    postal: 'Postal code',
    phone_primary: 'Primary phone',
    phone_secondary: 'Secondary phone (optional)',
    emergency_name: 'Emergency contact name',
    emergency_phone: 'Emergency contact phone',
    emergency_rel: 'Relationship',
    is_minor: 'This patient is under 18',
    guardian_name: 'Parent / Guardian name',
    guardian_phone: 'Parent / Guardian phone',
    guardian_rel: 'Relationship to patient',

    // Insurance
    insurance_title: 'Insurance',
    has_insurance: 'I have dental insurance',
    no_insurance: 'I do not have dental insurance',
    primary_insurance: 'Primary insurance',
    secondary_insurance: 'Secondary insurance (if applicable)',
    has_secondary: 'I have a second insurance plan',
    provider_name: 'Insurance provider',
    plan_name: 'Plan name',
    policy_number: 'Policy number',
    certificate_number: 'Certificate / Member number',
    group_number: 'Group number',
    subscriber_name: 'Subscriber name (if different)',
    subscriber_dob: 'Subscriber date of birth',
    subscriber_rel: 'Your relationship to subscriber',
    rel_opts: ['Self', 'Spouse', 'Parent', 'Other'],

    // Medical
    medical_title: 'Medical History',
    medical_sub: 'This information helps us provide safe dental care.',
    allergies_q: 'Do you have any known allergies?',
    allergy_name: 'Allergy',
    allergy_severity: 'Severity',
    allergy_reaction: 'Reaction',
    add_allergy: '+ Add allergy',
    medications_q: 'Are you currently taking any medications?',
    med_name: 'Medication name',
    med_dosage: 'Dosage',
    med_frequency: 'Frequency',
    add_medication: '+ Add medication',
    conditions_title: 'Do you have any of the following conditions?',
    conditions: {
      diabetes: 'Diabetes',
      heart_disease: 'Heart disease',
      high_blood_pressure: 'High blood pressure',
      blood_thinners: 'Blood thinners',
      osteoporosis: 'Osteoporosis',
      cancer: 'Cancer (current or past)',
      respiratory: 'Respiratory conditions (asthma, COPD)',
      kidney_disease: 'Kidney disease',
      liver_disease: 'Liver disease',
      thyroid: 'Thyroid condition',
      epilepsy: 'Epilepsy',
      hiv_aids: 'HIV/AIDS',
    },
    other_conditions: 'Other conditions (please describe)',
    pregnant_q: 'Are you pregnant or is there a possibility you may be pregnant?',
    physician_name: 'Your family physician name',
    physician_phone: 'Physician phone',
    smoker_q: 'Do you smoke or use tobacco?',
    smoker_opts: ['Never', 'Former smoker', 'Current smoker'],
    last_physical: 'Date of last physical exam',

    // Dental
    dental_title: 'Dental History',
    prev_dentist: 'Previous dentist name',
    prev_clinic: 'Previous clinic / practice',
    prev_city: 'City',
    reason_leaving: 'Reason for leaving',
    last_visit: 'Date of last dental visit',
    last_xray: 'Date of last X-rays',
    chief_complaint: 'Main reason for your visit today',
    anxiety_q: 'How would you rate your dental anxiety?',
    anxiety_none: 'None',
    anxiety_severe: 'Severe',
    dental_conditions: 'Please check all that apply:',
    dental_conds: {
      has_crowns: 'Crowns or caps',
      has_bridges: 'Bridges',
      has_implants: 'Dental implants',
      has_dentures: 'Dentures or partials',
      had_orthodontics: 'Orthodontic treatment (braces)',
      has_gum_disease: 'Gum disease / periodontitis',
      grinds_teeth: 'Grinding or clenching teeth',
      has_tmj: 'Jaw pain / TMJ',
      has_dry_mouth: 'Dry mouth',
      sensitive_teeth: 'Sensitive teeth',
    },
    brushing_q: 'How often do you brush?',
    brushing_opts: ['Once a day', 'Twice a day', 'More than twice'],
    flossing_q: 'How often do you floss?',
    flossing_opts: ['Never', 'Sometimes', 'Daily'],
    mouthwash_q: 'Do you use mouthwash?',

    // Consents
    consents_title: 'Consents & Signature',
    consent_treatment_label: 'I consent to dental examination and treatment as recommended by the dentist.',
    consent_pipeda_label: 'I consent to the collection and use of my personal information in accordance with Quebec Law 25 (formerly Bill 64) and PIPEDA.',
    consent_email_label: 'I consent to receive appointment confirmations and clinic communications by email.',
    consent_sms_label: 'I consent to receive appointment reminders by SMS/text message.',
    signature_label: 'Signature',
    signature_placeholder: 'Type your full legal name as your electronic signature',
    signature_note: 'By typing your name above, you confirm that all information provided is accurate and complete.',
    guardian_signature_label: 'Parent / Guardian signature',
    yes: 'Yes',
    no: 'No',
    required: 'Required',
  },
  fr: {
    title: 'Formulaire d\'admission du patient',
    subtitle: 'Veuillez remplir toutes les sections avant votre première visite.',
    steps: ['Identité', 'Assurance', 'Médical', 'Dentaire', 'Consentements'],
    next: 'Continuer',
    back: 'Retour',
    submit: 'Soumettre pour révision',
    submitting: 'Envoi en cours...',
    submitted_title: 'Formulaire soumis!',
    submitted_sub: 'Notre équipe examinera vos informations et confirmera votre inscription sous peu.',
    lang_toggle: 'English',

    identity_title: 'Identité & Contact',
    full_name: 'Nom légal complet',
    preferred_name: 'Nom préféré (optionnel)',
    dob: 'Date de naissance',
    gender: 'Genre',
    gender_opts: ['Homme', 'Femme', 'Non-binaire', 'Préfère ne pas répondre'],
    language: 'Langue préférée',
    address: 'Adresse',
    address2: 'Apt / Bureau (optionnel)',
    city: 'Ville',
    province: 'Province',
    postal: 'Code postal',
    phone_primary: 'Téléphone principal',
    phone_secondary: 'Téléphone secondaire (optionnel)',
    emergency_name: 'Contact d\'urgence',
    emergency_phone: 'Téléphone d\'urgence',
    emergency_rel: 'Relation',
    is_minor: 'Ce patient a moins de 18 ans',
    guardian_name: 'Nom du parent / tuteur',
    guardian_phone: 'Téléphone du parent / tuteur',
    guardian_rel: 'Relation avec le patient',

    insurance_title: 'Assurance',
    has_insurance: 'J\'ai une assurance dentaire',
    no_insurance: 'Je n\'ai pas d\'assurance dentaire',
    primary_insurance: 'Assurance principale',
    secondary_insurance: 'Assurance secondaire (si applicable)',
    has_secondary: 'J\'ai un deuxième régime d\'assurance',
    provider_name: 'Assureur',
    plan_name: 'Nom du régime',
    policy_number: 'Numéro de police',
    certificate_number: 'Numéro de certificat / membre',
    group_number: 'Numéro de groupe',
    subscriber_name: 'Nom de l\'abonné (si différent)',
    subscriber_dob: 'Date de naissance de l\'abonné',
    subscriber_rel: 'Votre lien avec l\'abonné',
    rel_opts: ['Moi-même', 'Conjoint(e)', 'Parent', 'Autre'],

    medical_title: 'Antécédents médicaux',
    medical_sub: 'Ces informations nous aident à vous prodiguer des soins dentaires sécuritaires.',
    allergies_q: 'Avez-vous des allergies connues?',
    allergy_name: 'Allergie',
    allergy_severity: 'Sévérité',
    allergy_reaction: 'Réaction',
    add_allergy: '+ Ajouter une allergie',
    medications_q: 'Prenez-vous actuellement des médicaments?',
    med_name: 'Nom du médicament',
    med_dosage: 'Dosage',
    med_frequency: 'Fréquence',
    add_medication: '+ Ajouter un médicament',
    conditions_title: 'Avez-vous l\'une des conditions suivantes?',
    conditions: {
      diabetes: 'Diabète',
      heart_disease: 'Maladie cardiaque',
      high_blood_pressure: 'Hypertension artérielle',
      blood_thinners: 'Anticoagulants',
      osteoporosis: 'Ostéoporose',
      cancer: 'Cancer (actuel ou passé)',
      respiratory: 'Conditions respiratoires (asthme, MPOC)',
      kidney_disease: 'Maladie rénale',
      liver_disease: 'Maladie du foie',
      thyroid: 'Condition thyroïdienne',
      epilepsy: 'Épilepsie',
      hiv_aids: 'VIH/SIDA',
    },
    other_conditions: 'Autres conditions (décrivez)',
    pregnant_q: 'Êtes-vous enceinte ou y a-t-il une possibilité que vous le soyez?',
    physician_name: 'Nom de votre médecin de famille',
    physician_phone: 'Téléphone du médecin',
    smoker_q: 'Fumez-vous ou consommez-vous du tabac?',
    smoker_opts: ['Jamais', 'Ancien fumeur', 'Fumeur actuel'],
    last_physical: 'Date du dernier examen médical',

    dental_title: 'Historique dentaire',
    prev_dentist: 'Nom du dentiste précédent',
    prev_clinic: 'Clinique / cabinet précédent',
    prev_city: 'Ville',
    reason_leaving: 'Raison du départ',
    last_visit: 'Date de la dernière visite dentaire',
    last_xray: 'Date des dernières radiographies',
    chief_complaint: 'Raison principale de votre visite aujourd\'hui',
    anxiety_q: 'Comment évaluez-vous votre anxiété dentaire?',
    anxiety_none: 'Aucune',
    anxiety_severe: 'Sévère',
    dental_conditions: 'Cochez tout ce qui s\'applique:',
    dental_conds: {
      has_crowns: 'Couronnes ou capuchons',
      has_bridges: 'Ponts dentaires',
      has_implants: 'Implants dentaires',
      has_dentures: 'Prothèses dentaires',
      had_orthodontics: 'Orthodontie (broches)',
      has_gum_disease: 'Maladie des gencives / parodontite',
      grinds_teeth: 'Grincement ou serrement des dents',
      has_tmj: 'Douleur à la mâchoire / ATM',
      has_dry_mouth: 'Bouche sèche',
      sensitive_teeth: 'Dents sensibles',
    },
    brushing_q: 'À quelle fréquence brossez-vous vos dents?',
    brushing_opts: ['Une fois par jour', 'Deux fois par jour', 'Plus de deux fois'],
    flossing_q: 'À quelle fréquence utilisez-vous la soie dentaire?',
    flossing_opts: ['Jamais', 'Parfois', 'Quotidiennement'],
    mouthwash_q: 'Utilisez-vous un rince-bouche?',

    consents_title: 'Consentements & Signature',
    consent_treatment_label: 'Je consens à l\'examen et au traitement dentaire recommandés par le dentiste.',
    consent_pipeda_label: 'Je consens à la collecte et à l\'utilisation de mes renseignements personnels conformément à la Loi 25 du Québec et à la LPRPDE.',
    consent_email_label: 'Je consens à recevoir des confirmations de rendez-vous et des communications de la clinique par courriel.',
    consent_sms_label: 'Je consens à recevoir des rappels de rendez-vous par SMS/message texte.',
    signature_label: 'Signature',
    signature_placeholder: 'Écrivez votre nom légal complet comme signature électronique',
    signature_note: 'En écrivant votre nom ci-dessus, vous confirmez que toutes les informations fournies sont exactes et complètes.',
    guardian_signature_label: 'Signature du parent / tuteur',
    yes: 'Oui',
    no: 'Non',
    required: 'Obligatoire',
  }
}

type Lang = 'en' | 'fr'

export default function IntakePage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [lang, setLang] = useState<Lang>('en')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [clinicId, setClinicId] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const t = T[lang]

  // ── Form state ────────────────────────────────────────────────────────────

  // Identity
  const [identity, setIdentity] = useState({
    full_name: '', preferred_name: '', date_of_birth: '',
    gender: '', preferred_language: 'en',
    address_line1: '', address_line2: '', city: 'Montréal', province: 'QC', postal_code: '',
    phone_primary: '', phone_secondary: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    is_minor: false, guardian_name: '', guardian_relationship: '', guardian_phone: ''
  })

  // Insurance
  const [hasInsurance, setHasInsurance] = useState(true)
  const [hasSecondary, setHasSecondary] = useState(false)
  const [primaryIns, setPrimaryIns] = useState({ provider_name: '', plan_name: '', policy_number: '', certificate_number: '', group_number: '', subscriber_name: '', subscriber_dob: '', subscriber_relationship: 'self' })
  const [secondaryIns, setSecondaryIns] = useState({ provider_name: '', plan_name: '', policy_number: '', certificate_number: '', group_number: '', subscriber_name: '', subscriber_dob: '', subscriber_relationship: 'self' })

  // Medical
  const [hasAllergies, setHasAllergies] = useState(false)
  const [allergies, setAllergies] = useState([{ name: '', severity: '', reaction: '' }])
  const [takesMeds, setTakesMeds] = useState(false)
  const [medications, setMedications] = useState([{ name: '', dosage: '', frequency: '' }])
  const [conditions, setConditions] = useState<Record<string, boolean>>({})
  const [otherConditions, setOtherConditions] = useState('')
  const [isPregnant, setIsPregnant] = useState(false)
  const [physicianName, setPhysicianName] = useState('')
  const [physicianPhone, setPhysicianPhone] = useState('')
  const [smoker, setSmoker] = useState('never')
  const [lastPhysical, setLastPhysical] = useState('')

  // Dental
  const [dental, setDental] = useState({
    previous_dentist_name: '', previous_dentist_clinic: '', previous_dentist_city: '',
    reason_for_leaving: '', last_visit_date: '', last_xray_date: '',
    chief_complaint: '', dental_anxiety: 0,
    brushing_frequency: 'twice', flossing_frequency: 'sometimes', uses_mouthwash: false
  })
  const [dentalConds, setDentalConds] = useState<Record<string, boolean>>({})

  // Consents
  const [consents, setConsents] = useState({
    consent_treatment: false, consent_pipeda: false,
    consent_communication_email: false, consent_communication_sms: false
  })
  const [signature, setSignature] = useState('')
  const [guardianSignature, setGuardianSignature] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    params.then(p => setSlug(p.slug))
  }, [params])

  useEffect(() => {
    if (!slug) return
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: account } = await supabase.from('patient_accounts')
        .select('patient_id, clinic_id').eq('auth_id', user.id).single()
      if (!account) { router.push(`/clinic/${slug}`); return }
      setPatientId(account.patient_id)
      setClinicId(account.clinic_id)

      // Check if already submitted
      const { data: patient } = await supabase.from('patients')
        .select('full_name, intake_status').eq('id', account.patient_id).single()
      if (patient?.intake_status === 'pending_review' || patient?.intake_status === 'approved') {
        setSubmitted(true)
      }
      // Store rejection reason if rejected
      if (patient?.intake_status === 'rejected') {
        // Allow resubmit - don't set submitted true
        // Pre-fill name already handled below
      }
      if (patient?.full_name) setIdentity(prev => ({ ...prev, full_name: patient.full_name }))
    }
    init()
  }, [slug])

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {}
    const req = lang === 'fr' ? 'Champ obligatoire' : 'Required'

    if (currentStep === 0) {
      if (!identity.full_name.trim()) newErrors.full_name = req
      if (!identity.date_of_birth) newErrors.date_of_birth = req
      if (!identity.phone_primary.trim()) newErrors.phone_primary = req
      if (!identity.address_line1.trim()) newErrors.address_line1 = req
      if (!identity.emergency_contact_name.trim()) newErrors.emergency_contact_name = req
      if (!identity.emergency_contact_phone.trim()) newErrors.emergency_contact_phone = req
      if (identity.is_minor && !identity.guardian_name.trim()) newErrors.guardian_name = req
      if (identity.is_minor && !identity.guardian_phone.trim()) newErrors.guardian_phone = req
    }

    if (currentStep === 1) {
      if (hasInsurance && !primaryIns.provider_name.trim()) newErrors.provider_name = req
      if (hasInsurance && !primaryIns.policy_number.trim()) newErrors.policy_number = req
    }

    if (currentStep === 4) {
      if (!consents.consent_treatment) newErrors.consent_treatment = req
      if (!consents.consent_pipeda) newErrors.consent_pipeda = req
      if (!signature.trim()) newErrors.signature = req
      if (identity.is_minor && !guardianSignature.trim()) newErrors.guardian_signature = req
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const submitIntake = async () => {
    if (!signature) return
    setLoading(true)

    try {
      // Update patients table
      await supabase.from('patients').update({
        ...identity,
        intake_status: 'pending_review',
        intake_submitted_at: new Date().toISOString()
      }).eq('id', patientId)

      // Insurance
      if (hasInsurance) {
        await supabase.from('patient_insurance').upsert([
          { patient_id: patientId, clinic_id: clinicId, coverage_order: 'primary', ...primaryIns }
        ])
        if (hasSecondary) {
          await supabase.from('patient_insurance').upsert([
            { patient_id: patientId, clinic_id: clinicId, coverage_order: 'secondary', ...secondaryIns }
          ])
        }
      }

      // Medical
      await supabase.from('patient_medical').upsert({
        patient_id: patientId, clinic_id: clinicId,
        has_allergies: hasAllergies,
        allergies: hasAllergies ? allergies.filter(a => a.name) : [],
        takes_medications: takesMeds,
        medications: takesMeds ? medications.filter(m => m.name) : [],
        conditions: { ...conditions, other: otherConditions },
        is_pregnant: isPregnant,
        physician_name: physicianName,
        physician_phone: physicianPhone,
        smoker,
        last_physical_date: lastPhysical || null
      })

      // Dental
      await supabase.from('patient_dental').upsert({
        patient_id: patientId, clinic_id: clinicId,
        ...dental, ...dentalConds
      })

      // Consents
      await supabase.from('patient_consents').upsert({
        patient_id: patientId, clinic_id: clinicId,
        ...consents,
        signature_text: signature,
        signed_at: new Date().toISOString(),
        guardian_signature_text: guardianSignature || null,
        guardian_signed_at: guardianSignature ? new Date().toISOString() : null
      })

      setSubmitted(true)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const u = (setter: (prev: any) => any) => setter

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'DM Sans, sans-serif', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '48px 40px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>{t.submitted_title}</div>
        <div style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>{t.submitted_sub}</div>
        <button onClick={() => router.push(`/clinic/${slug}/portal`)}
          style={{ padding: '11px 24px', background: '#0F172A', color: 'white', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Go to my portal
        </button>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; }
        .page { max-width: 640px; margin: 0 auto; padding: 32px 24px 80px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .form-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #0F172A; }
        .lang-btn { padding: 6px 14px; border: 1.5px solid #E2E8F0; border-radius: 20px; font-size: 12px; font-weight: 500; background: white; cursor: pointer; color: #475569; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .lang-btn:hover { background: #F8FAFC; }
        .steps { display: flex; gap: 4px; margin-bottom: 28px; }
        .step { flex: 1; height: 4px; border-radius: 2px; background: #E2E8F0; transition: background 0.2s; }
        .step.done { background: #0F172A; }
        .step.active { background: #0EA5E9; }
        .section-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .section-sub { font-size: 13px; color: #94A3B8; margin-bottom: 24px; }
        .card { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 20px; margin-bottom: 14px; }
        .card-title { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #F1F5F9; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { margin-bottom: 14px; }
        .field:last-child { margin-bottom: 0; }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; }
        input, select, textarea { width: 100%; padding: 9px 13px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; background: white; }
        input:focus, select:focus, textarea:focus { border-color: #0EA5E9; }
        textarea { resize: vertical; min-height: 80px; }
        .radio-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .radio-opt { padding: 8px 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; color: #475569; background: white; font-family: 'DM Sans', sans-serif; }
        .radio-opt.selected { border-color: #0EA5E9; background: #EFF6FF; color: #0EA5E9; font-weight: 500; }
        .toggle-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .toggle { width: 42px; height: 24px; border-radius: 12px; background: #E2E8F0; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; border: none; }
        .toggle.on { background: #0EA5E9; }
        .toggle-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform 0.2s; }
        .toggle.on .toggle-knob { transform: translateX(18px); }
        .toggle-label { font-size: 14px; color: #0F172A; }
        .checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .checkbox-item { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .checkbox-item input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; accent-color: #0EA5E9; }
        .checkbox-item span { font-size: 13px; color: #475569; }
        .add-btn { padding: 7px 14px; border: 1.5px dashed #CBD5E1; border-radius: 8px; font-size: 12px; font-weight: 500; color: #64748B; background: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; margin-top: 8px; }
        .add-btn:hover { border-color: #0EA5E9; color: #0EA5E9; }
        .remove-btn { padding: 4px 8px; border: none; background: #FEF2F2; color: #F87171; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .list-item { background: #F8FAFC; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
        .list-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12px; font-weight: 600; color: #94A3B8; }
        .anxiety-row { display: flex; align-items: center; gap: 8px; }
        .anxiety-label { font-size: 12px; color: #94A3B8; white-space: nowrap; }
        input[type=range] { flex: 1; accent-color: #0EA5E9; }
        .anxiety-val { font-size: 14px; font-weight: 600; color: #0F172A; width: 20px; text-align: center; }
        .consent-item { display: flex; gap: 12px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #F8FAFC; }
        .consent-item:last-child { border-bottom: none; }
        .consent-item input[type=checkbox] { width: 18px; height: 18px; margin-top: 1px; cursor: pointer; accent-color: #0EA5E9; flex-shrink: 0; }
        .consent-text { font-size: 14px; color: #0F172A; line-height: 1.5; }
        .required-tag { font-size: 10px; font-weight: 600; color: #F87171; text-transform: uppercase; }
        .sig-note { font-size: 12px; color: #94A3B8; margin-top: 8px; line-height: 1.5; }
        .field-error { font-size: 11px; color: #F43F5E; margin-top: 4px; font-weight: 500; }
        input.error, select.error, textarea.error { border-color: #F43F5E !important; }
        .footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 28px; }
        .btn { padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; transition: all 0.15s; }
        .btn-back { background: #F8FAFC; color: #475569; border: 1.5px solid #E2E8F0; }
        .btn-back:hover { background: #F1F5F9; }
        .btn-next { background: #0F172A; color: white; flex: 1; }
        .btn-next:hover { background: #1E293B; }
        .btn-next:disabled { opacity: 0.5; cursor: not-allowed; }
        .ins-toggle { display: flex; gap: 10px; margin-bottom: 16px; }
        .ins-opt { flex: 1; padding: 12px; border: 1.5px solid #E2E8F0; border-radius: 10px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 500; color: #475569; background: white; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .ins-opt.selected { border-color: #0EA5E9; background: #EFF6FF; color: #0EA5E9; }
      `}</style>

      <div className="page">
        <div className="topbar">
          <div className="form-title">{t.title}</div>
          <button className="lang-btn" onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}>
            {t.lang_toggle}
          </button>
        </div>

        <div className="steps">
          {t.steps.map((_, i) => (
            <div key={i} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
          ))}
        </div>

        {/* ── STEP 0: IDENTITY ── */}
        {step === 0 && (
          <>
            <div className="section-title">{t.identity_title}</div>
            <div className="section-sub">{t.subtitle}</div>

            <div className="card">
              <div className="grid-2">
                <div className="field"><label>{t.full_name} *</label>
                  <input className={errors.full_name ? 'error' : ''} value={identity.full_name} onChange={e => setIdentity(p => ({ ...p, full_name: e.target.value }))} />{errors.full_name && <div className="field-error">{errors.full_name}</div>}</div>
                <div className="field"><label>{t.preferred_name}</label>
                  <input value={identity.preferred_name} onChange={e => setIdentity(p => ({ ...p, preferred_name: e.target.value }))} /></div>
                <div className="field"><label>{t.dob} *</label>
                  <input type="date" className={errors.date_of_birth ? 'error' : ''} value={identity.date_of_birth} onChange={e => setIdentity(p => ({ ...p, date_of_birth: e.target.value }))} />{errors.date_of_birth && <div className="field-error">{errors.date_of_birth}</div>}</div>
                <div className="field"><label>{t.gender}</label>
                  <select value={identity.gender} onChange={e => setIdentity(p => ({ ...p, gender: e.target.value }))}>
                    <option value="">—</option>
                    {t.gender_opts.map(o => <option key={o} value={o.toLowerCase().replace(/ /g, '_')}>{o}</option>)}
                  </select></div>
              </div>

              <div className="field"><label>{t.language}</label>
                <div className="radio-row">
                  {['English', 'Français'].map(l => (
                    <button key={l} className={`radio-opt ${identity.preferred_language === (l === 'English' ? 'en' : 'fr') ? 'selected' : ''}`}
                      onClick={() => setIdentity(p => ({ ...p, preferred_language: l === 'English' ? 'en' : 'fr' }))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Address</div>
              <div className="field"><label>{t.address} *</label>
                <input className={errors.address_line1 ? 'error' : ''} value={identity.address_line1} onChange={e => setIdentity(p => ({ ...p, address_line1: e.target.value }))} />{errors.address_line1 && <div className="field-error">{errors.address_line1}</div>}</div>
              <div className="field"><label>{t.address2}</label>
                <input value={identity.address_line2} onChange={e => setIdentity(p => ({ ...p, address_line2: e.target.value }))} /></div>
              <div className="grid-2">
                <div className="field"><label>{t.city}</label>
                  <input value={identity.city} onChange={e => setIdentity(p => ({ ...p, city: e.target.value }))} /></div>
                <div className="field"><label>{t.postal}</label>
                  <input value={identity.postal_code} onChange={e => setIdentity(p => ({ ...p, postal_code: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Phone</div>
              <div className="grid-2">
                <div className="field"><label>{t.phone_primary} *</label>
                  <input className={errors.phone_primary ? 'error' : ''} value={identity.phone_primary} onChange={e => setIdentity(p => ({ ...p, phone_primary: e.target.value }))} placeholder="514-555-0100" />{errors.phone_primary && <div className="field-error">{errors.phone_primary}</div>}</div>
                <div className="field"><label>{t.phone_secondary}</label>
                  <input value={identity.phone_secondary} onChange={e => setIdentity(p => ({ ...p, phone_secondary: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Emergency contact</div>
              <div className="grid-2">
                <div className="field"><label>{t.emergency_name} *</label>
                  <input className={errors.emergency_contact_name ? 'error' : ''} value={identity.emergency_contact_name} onChange={e => setIdentity(p => ({ ...p, emergency_contact_name: e.target.value }))} />{errors.emergency_contact_name && <div className="field-error">{errors.emergency_contact_name}</div>}</div>
                <div className="field"><label>{t.emergency_phone} *</label>
                  <input className={errors.emergency_contact_phone ? 'error' : ''} value={identity.emergency_contact_phone} onChange={e => setIdentity(p => ({ ...p, emergency_contact_phone: e.target.value }))} />{errors.emergency_contact_phone && <div className="field-error">{errors.emergency_contact_phone}</div>}</div>
                <div className="field"><label>{t.emergency_rel}</label>
                  <input value={identity.emergency_contact_relationship} onChange={e => setIdentity(p => ({ ...p, emergency_contact_relationship: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card">
              <div className="toggle-row">
                <button className={`toggle ${identity.is_minor ? 'on' : ''}`}
                  onClick={() => setIdentity(p => ({ ...p, is_minor: !p.is_minor }))}>
                  <div className="toggle-knob" />
                </button>
                <span className="toggle-label">{t.is_minor}</span>
              </div>
              {identity.is_minor && (
                <div className="grid-2">
                  <div className="field"><label>{t.guardian_name}</label>
                    <input value={identity.guardian_name} onChange={e => setIdentity(p => ({ ...p, guardian_name: e.target.value }))} /></div>
                  <div className="field"><label>{t.guardian_phone}</label>
                    <input value={identity.guardian_phone} onChange={e => setIdentity(p => ({ ...p, guardian_phone: e.target.value }))} /></div>
                  <div className="field"><label>{t.guardian_rel}</label>
                    <input value={identity.guardian_relationship} onChange={e => setIdentity(p => ({ ...p, guardian_relationship: e.target.value }))} /></div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STEP 1: INSURANCE ── */}
        {step === 1 && (
          <>
            <div className="section-title">{t.insurance_title}</div>
            <div className="section-sub"> </div>

            <div className="ins-toggle">
              <button className={`ins-opt ${hasInsurance ? 'selected' : ''}`} onClick={() => setHasInsurance(true)}>{t.has_insurance}</button>
              <button className={`ins-opt ${!hasInsurance ? 'selected' : ''}`} onClick={() => setHasInsurance(false)}>{t.no_insurance}</button>
            </div>

            {hasInsurance && (
              <>
                <div className="card">
                  <div className="card-title">{t.primary_insurance}</div>
                  <div className="grid-2">
                    <div className="field"><label>{t.provider_name} *</label>
                      <input value={primaryIns.provider_name} onChange={e => setPrimaryIns(p => ({ ...p, provider_name: e.target.value }))} placeholder="Sun Life, Manulife..." /></div>
                    <div className="field"><label>{t.plan_name}</label>
                      <input value={primaryIns.plan_name} onChange={e => setPrimaryIns(p => ({ ...p, plan_name: e.target.value }))} /></div>
                    <div className="field"><label>{t.policy_number}</label>
                      <input value={primaryIns.policy_number} onChange={e => setPrimaryIns(p => ({ ...p, policy_number: e.target.value }))} /></div>
                    <div className="field"><label>{t.certificate_number}</label>
                      <input value={primaryIns.certificate_number} onChange={e => setPrimaryIns(p => ({ ...p, certificate_number: e.target.value }))} /></div>
                    <div className="field"><label>{t.group_number}</label>
                      <input value={primaryIns.group_number} onChange={e => setPrimaryIns(p => ({ ...p, group_number: e.target.value }))} /></div>
                    <div className="field"><label>{t.subscriber_rel}</label>
                      <select value={primaryIns.subscriber_relationship} onChange={e => setPrimaryIns(p => ({ ...p, subscriber_relationship: e.target.value }))}>
                        {t.rel_opts.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                      </select></div>
                    {primaryIns.subscriber_relationship !== 'self' && (
                      <>
                        <div className="field"><label>{t.subscriber_name}</label>
                          <input value={primaryIns.subscriber_name} onChange={e => setPrimaryIns(p => ({ ...p, subscriber_name: e.target.value }))} /></div>
                        <div className="field"><label>{t.subscriber_dob}</label>
                          <input type="date" value={primaryIns.subscriber_dob} onChange={e => setPrimaryIns(p => ({ ...p, subscriber_dob: e.target.value }))} /></div>
                      </>
                    )}
                  </div>
                </div>

                <div className="toggle-row">
                  <button className={`toggle ${hasSecondary ? 'on' : ''}`} onClick={() => setHasSecondary(!hasSecondary)}>
                    <div className="toggle-knob" />
                  </button>
                  <span className="toggle-label">{t.has_secondary}</span>
                </div>

                {hasSecondary && (
                  <div className="card">
                    <div className="card-title">{t.secondary_insurance}</div>
                    <div className="grid-2">
                      <div className="field"><label>{t.provider_name}</label>
                        <input value={secondaryIns.provider_name} onChange={e => setSecondaryIns(p => ({ ...p, provider_name: e.target.value }))} /></div>
                      <div className="field"><label>{t.policy_number}</label>
                        <input value={secondaryIns.policy_number} onChange={e => setSecondaryIns(p => ({ ...p, policy_number: e.target.value }))} /></div>
                      <div className="field"><label>{t.certificate_number}</label>
                        <input value={secondaryIns.certificate_number} onChange={e => setSecondaryIns(p => ({ ...p, certificate_number: e.target.value }))} /></div>
                      <div className="field"><label>{t.group_number}</label>
                        <input value={secondaryIns.group_number} onChange={e => setSecondaryIns(p => ({ ...p, group_number: e.target.value }))} /></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── STEP 2: MEDICAL ── */}
        {step === 2 && (
          <>
            <div className="section-title">{t.medical_title}</div>
            <div className="section-sub">{t.medical_sub}</div>

            <div className="card">
              <div className="toggle-row">
                <button className={`toggle ${hasAllergies ? 'on' : ''}`} onClick={() => setHasAllergies(!hasAllergies)}>
                  <div className="toggle-knob" />
                </button>
                <span className="toggle-label">{t.allergies_q}</span>
              </div>
              {hasAllergies && (
                <>
                  {allergies.map((a, i) => (
                    <div key={i} className="list-item">
                      <div className="list-item-header">
                        <span>Allergie / Allergy {i + 1}</span>
                        {i > 0 && <button className="remove-btn" onClick={() => setAllergies(prev => prev.filter((_, j) => j !== i))}>✕</button>}
                      </div>
                      <div className="grid-2">
                        <div className="field"><label>{t.allergy_name}</label>
                          <input value={a.name} onChange={e => setAllergies(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Penicillin, latex..." /></div>
                        <div className="field"><label>{t.allergy_severity}</label>
                          <select value={a.severity} onChange={e => setAllergies(prev => prev.map((x, j) => j === i ? { ...x, severity: e.target.value } : x))}>
                            <option value="">—</option>
                            <option value="mild">Mild / Légère</option>
                            <option value="moderate">Moderate / Modérée</option>
                            <option value="severe">Severe / Sévère</option>
                          </select></div>
                        <div className="field" style={{ gridColumn: 'span 2' }}><label>{t.allergy_reaction}</label>
                          <input value={a.reaction} onChange={e => setAllergies(prev => prev.map((x, j) => j === i ? { ...x, reaction: e.target.value } : x))} /></div>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setAllergies(prev => [...prev, { name: '', severity: '', reaction: '' }])}>
                    {t.add_allergy}
                  </button>
                </>
              )}
            </div>

            <div className="card">
              <div className="toggle-row">
                <button className={`toggle ${takesMeds ? 'on' : ''}`} onClick={() => setTakesMeds(!takesMeds)}>
                  <div className="toggle-knob" />
                </button>
                <span className="toggle-label">{t.medications_q}</span>
              </div>
              {takesMeds && (
                <>
                  {medications.map((m, i) => (
                    <div key={i} className="list-item">
                      <div className="list-item-header">
                        <span>Médicament / Medication {i + 1}</span>
                        {i > 0 && <button className="remove-btn" onClick={() => setMedications(prev => prev.filter((_, j) => j !== i))}>✕</button>}
                      </div>
                      <div className="grid-2">
                        <div className="field"><label>{t.med_name}</label>
                          <input value={m.name} onChange={e => setMedications(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                        <div className="field"><label>{t.med_dosage}</label>
                          <input value={m.dosage} onChange={e => setMedications(prev => prev.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))} placeholder="10mg" /></div>
                        <div className="field"><label>{t.med_frequency}</label>
                          <input value={m.frequency} onChange={e => setMedications(prev => prev.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} placeholder="Once daily..." /></div>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setMedications(prev => [...prev, { name: '', dosage: '', frequency: '' }])}>
                    {t.add_medication}
                  </button>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">{t.conditions_title}</div>
              <div className="checkbox-grid">
                {Object.entries(t.conditions).map(([key, label]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox" checked={!!conditions[key]}
                      onChange={e => setConditions(p => ({ ...p, [key]: e.target.checked }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="field" style={{ marginTop: '14px' }}>
                <label>{t.other_conditions}</label>
                <textarea value={otherConditions} onChange={e => setOtherConditions(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="card">
              <div className="toggle-row">
                <button className={`toggle ${isPregnant ? 'on' : ''}`} onClick={() => setIsPregnant(!isPregnant)}>
                  <div className="toggle-knob" />
                </button>
                <span className="toggle-label">{t.pregnant_q}</span>
              </div>

              <div className="field"><label>{t.smoker_q}</label>
                <div className="radio-row">
                  {t.smoker_opts.map((o, i) => {
                    const vals = ['never', 'former', 'current']
                    return <button key={o} className={`radio-opt ${smoker === vals[i] ? 'selected' : ''}`}
                      onClick={() => setSmoker(vals[i])}>{o}</button>
                  })}
                </div>
              </div>

              <div className="grid-2">
                <div className="field"><label>{t.physician_name}</label>
                  <input value={physicianName} onChange={e => setPhysicianName(e.target.value)} /></div>
                <div className="field"><label>{t.physician_phone}</label>
                  <input value={physicianPhone} onChange={e => setPhysicianPhone(e.target.value)} /></div>
                <div className="field"><label>{t.last_physical}</label>
                  <input type="date" value={lastPhysical} onChange={e => setLastPhysical(e.target.value)} /></div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 3: DENTAL ── */}
        {step === 3 && (
          <>
            <div className="section-title">{t.dental_title}</div>
            <div className="section-sub"> </div>

            <div className="card">
              <div className="card-title">Previous dentist</div>
              <div className="grid-2">
                <div className="field"><label>{t.prev_dentist}</label>
                  <input value={dental.previous_dentist_name} onChange={e => setDental(p => ({ ...p, previous_dentist_name: e.target.value }))} /></div>
                <div className="field"><label>{t.prev_clinic}</label>
                  <input value={dental.previous_dentist_clinic} onChange={e => setDental(p => ({ ...p, previous_dentist_clinic: e.target.value }))} /></div>
                <div className="field"><label>{t.prev_city}</label>
                  <input value={dental.previous_dentist_city} onChange={e => setDental(p => ({ ...p, previous_dentist_city: e.target.value }))} /></div>
                <div className="field"><label>{t.reason_leaving}</label>
                  <input value={dental.reason_for_leaving} onChange={e => setDental(p => ({ ...p, reason_for_leaving: e.target.value }))} /></div>
                <div className="field"><label>{t.last_visit}</label>
                  <input type="date" value={dental.last_visit_date} onChange={e => setDental(p => ({ ...p, last_visit_date: e.target.value }))} /></div>
                <div className="field"><label>{t.last_xray}</label>
                  <input type="date" value={dental.last_xray_date} onChange={e => setDental(p => ({ ...p, last_xray_date: e.target.value }))} /></div>
              </div>
              <div className="field"><label>{t.chief_complaint}</label>
                <textarea value={dental.chief_complaint} onChange={e => setDental(p => ({ ...p, chief_complaint: e.target.value }))} rows={2} /></div>

              <div className="field">
                <label>{t.anxiety_q}</label>
                <div className="anxiety-row">
                  <span className="anxiety-label">{t.anxiety_none}</span>
                  <input type="range" min={0} max={5} value={dental.dental_anxiety}
                    onChange={e => setDental(p => ({ ...p, dental_anxiety: parseInt(e.target.value) }))} />
                  <span className="anxiety-label">{t.anxiety_severe}</span>
                  <span className="anxiety-val">{dental.dental_anxiety}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">{t.dental_conditions}</div>
              <div className="checkbox-grid">
                {Object.entries(t.dental_conds).map(([key, label]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox" checked={!!dentalConds[key]}
                      onChange={e => setDentalConds(p => ({ ...p, [key]: e.target.checked }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Oral hygiene</div>
              <div className="field"><label>{t.brushing_q}</label>
                <div className="radio-row">
                  {t.brushing_opts.map((o, i) => {
                    const vals = ['once', 'twice', 'more']
                    return <button key={o} className={`radio-opt ${dental.brushing_frequency === vals[i] ? 'selected' : ''}`}
                      onClick={() => setDental(p => ({ ...p, brushing_frequency: vals[i] }))}>{o}</button>
                  })}
                </div>
              </div>
              <div className="field"><label>{t.flossing_q}</label>
                <div className="radio-row">
                  {t.flossing_opts.map((o, i) => {
                    const vals = ['never', 'sometimes', 'daily']
                    return <button key={o} className={`radio-opt ${dental.flossing_frequency === vals[i] ? 'selected' : ''}`}
                      onClick={() => setDental(p => ({ ...p, flossing_frequency: vals[i] }))}>{o}</button>
                  })}
                </div>
              </div>
              <div className="toggle-row">
                <button className={`toggle ${dental.uses_mouthwash ? 'on' : ''}`}
                  onClick={() => setDental(p => ({ ...p, uses_mouthwash: !p.uses_mouthwash }))}>
                  <div className="toggle-knob" />
                </button>
                <span className="toggle-label">{t.mouthwash_q}</span>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 4: CONSENTS ── */}
        {step === 4 && (
          <>
            <div className="section-title">{t.consents_title}</div>
            <div className="section-sub"> </div>

            <div className="card">
              <div className="consent-item">
                <input type="checkbox" checked={consents.consent_treatment}
                  onChange={e => setConsents(p => ({ ...p, consent_treatment: e.target.checked }))} />
                <div>
                  <div className="consent-text">{t.consent_treatment_label}</div>
                  <span className="required-tag">{t.required}</span>
                </div>
              </div>
              <div className="consent-item">
                <input type="checkbox" checked={consents.consent_pipeda}
                  onChange={e => setConsents(p => ({ ...p, consent_pipeda: e.target.checked }))} />
                <div>
                  <div className="consent-text">{t.consent_pipeda_label}</div>
                  <span className="required-tag">{t.required}</span>
                </div>
              </div>
              <div className="consent-item">
                <input type="checkbox" checked={consents.consent_communication_email}
                  onChange={e => setConsents(p => ({ ...p, consent_communication_email: e.target.checked }))} />
                <div className="consent-text">{t.consent_email_label}</div>
              </div>
              <div className="consent-item">
                <input type="checkbox" checked={consents.consent_communication_sms}
                  onChange={e => setConsents(p => ({ ...p, consent_communication_sms: e.target.checked }))} />
                <div className="consent-text">{t.consent_sms_label}</div>
              </div>
            </div>

            <div className="card">
              <div className="field">
                <label>{t.signature_label} *</label>
                <input className={errors.signature ? 'error' : ''} value={signature} onChange={e => setSignature(e.target.value)}
                  placeholder={t.signature_placeholder}
                  style={{ fontStyle: signature ? 'italic' : 'normal', fontSize: signature ? '16px' : '14px' }} />{errors.signature && <div className="field-error">{errors.signature}</div>}
                <div className="sig-note">{t.signature_note}</div>
              </div>
              {identity.is_minor && (
                <div className="field" style={{ marginTop: '14px' }}>
                  <label>{t.guardian_signature_label} *</label>
                  <input value={guardianSignature} onChange={e => setGuardianSignature(e.target.value)}
                    placeholder={t.signature_placeholder}
                    style={{ fontStyle: guardianSignature ? 'italic' : 'normal' }} />
                </div>
              )}
            </div>
          </>
        )}

        <div className="footer">
          {step > 0 && (
            <button className="btn btn-back" onClick={() => setStep(s => s - 1)}>{t.back}</button>
          )}
          {step < 4 ? (
            <button className="btn btn-next" onClick={() => { if (validateStep(step)) setStep(s => s + 1) }}>{t.next}</button>
          ) : (
            <button className="btn btn-next"
              disabled={loading}
              onClick={() => { if (validateStep(4)) submitIntake() }}>
              {loading ? t.submitting : t.submit}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

