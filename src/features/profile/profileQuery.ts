import { fetchProfile } from './profile.ts'

/** A leitura do perfil no cache do TanStack Query, a mesma para a página e para o formulário. */
export const PROFILE_QUERY = { queryKey: ['profile'], queryFn: fetchProfile } as const
