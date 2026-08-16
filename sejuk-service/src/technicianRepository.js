export function createTechnicianRepository(supabase) {
  return {
    async listTechnicians() {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, branch, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      return (data ?? []).map(mapTechnicianRow)
    },
  }
}

function mapTechnicianRow(row) {
  return {
    branch: row.branch,
    id: row.id,
    name: row.name,
  }
}
