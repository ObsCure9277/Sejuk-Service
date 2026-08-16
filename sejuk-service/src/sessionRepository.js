export function createSessionRepository(supabase) {
  return {
    async getCurrentProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) return null

      return loadProfileForUser(supabase, user.id)
    },

    async signInWithPassword({ email, password }) {
      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error
      if (!user) return null

      return loadProfileForUser(supabase, user.id)
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()

      if (error) throw error
    },
  }
}

export function mapProfileRow(row) {
  return {
    displayName: row.display_name,
    role: row.role,
    technicianId: row.technician_id,
    userId: row.user_id,
  }
}

async function loadProfileForUser(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, technician_id')
    .eq('user_id', userId)
    .single()

  if (error) throw error

  return mapProfileRow(data)
}
