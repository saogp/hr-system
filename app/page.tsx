import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')

  if (error) {
    console.error('Feil ved henting av ansatte:', error)
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Ansattoversikt</h1>
      
      <div className="grid gap-4">
        {employees && employees.length > 0 ? (
          employees.map((emp) => (
            <div key={emp.id} className="p-4 border rounded-lg shadow-sm bg-white text-black">
              <h2 className="text-xl font-semibold">{emp.name}</h2>
              <p className="text-gray-600">{emp.position}</p>
              <p className="text-sm text-gray-500">{emp.email}</p>
            </div>
          ))
        ) : (
          <p>Ingen ansatte funnet.</p>
        )}
      </div>
    </main>
  )
}