import { supabase } from './_client'

// Lưu user mới
export async function addUser(user) {
  const { data, error } = await supabase
    .from('users')
    .insert([user])

  if (error) {
    console.error("❌ Error inserting user:", error)
    throw error
  }
  return data
}

// Lấy danh sách user
export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')

  if (error) {
    console.error("❌ Error fetching users:", error)
    throw error
  }
  return data
}
