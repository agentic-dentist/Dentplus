'use client'

import { createContext, useContext } from 'react'

export interface ClinicUser {
  clinicId: string
  staffId: string        // empty string if owner without staff_account
  staffName: string
  staffRole: string      // 'owner' | 'dentist' | 'hygienist' | 'receptionist' etc
  isOwner: boolean
  clinicName: string
}

export const ClinicContext = createContext<ClinicUser>({
  clinicId: '',
  staffId: '',
  staffName: '',
  staffRole: '',
  isOwner: false,
  clinicName: '',
})

export function useClinicUser() {
  return useContext(ClinicContext)
}
