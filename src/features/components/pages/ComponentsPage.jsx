import { useState, useMemo } from 'react'
import { useComponentsList } from '../hooks/useComponents'
import { ComponentCard } from '../components/ComponentCard'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { cn } from '@/shared/utils/cn'

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search components..."
        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition"
      />
    </div>
  )
}

function ComponentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col gap-3">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-9 w-full mt-1" />
    </div>
  )
}

export default function ComponentsPage() {
  const { components, loading, error } = useComponentsList()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeLab, setActiveLab] = useState('All Labs')

  const categories = useMemo(() => {
    const cats = [...new Set(components.map((c) => c.category).filter(Boolean))]
    return ['All', ...cats.sort()]
  }, [components])

  const labs = useMemo(() => {
    const labSet = [...new Set(components.map((c) => c.lab_name).filter(Boolean))]
    return ['All Labs', ...labSet.sort()]
  }, [components])

  const filtered = useMemo(() => {
    return components.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchCat = activeCategory === 'All' || c.category === activeCategory
      const matchLab = activeLab === 'All Labs' || c.lab_name === activeLab
      return matchSearch && matchCat && matchLab
    })
  }, [components, search, activeCategory, activeLab])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Lab Components</h1>
        <p className="text-sm text-slate-500 mt-1">Browse available components and add them to your cart.</p>
      </div>

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              activeCategory === cat
                ? 'bg-[#0D9488] text-white border-[#0D9488]'
                : 'bg-white text-slate-600 border-[#E2E8F0] hover:border-[#0D9488] hover:text-[#0D9488]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lab filter */}
      {labs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {labs.map((lab) => (
            <button
              key={lab}
              onClick={() => setActiveLab(lab)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                activeLab === lab
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-[#E2E8F0] hover:border-slate-400 hover:text-slate-800'
              )}
            >
              {lab}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          Failed to load components: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ComponentCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No components found"
          description={search || activeCategory !== 'All' || activeLab !== 'All Labs' ? 'Try adjusting your search or filter.' : 'No components have been added yet.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((comp) => (
            <ComponentCard key={comp.id} component={comp} />
          ))}
        </div>
      )}
    </div>
  )
}
