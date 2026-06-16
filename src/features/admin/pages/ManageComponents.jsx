import { useState, useMemo } from 'react'
import { useAllComponents, useCreateComponent, useUpdateComponent, useDeleteComponent } from '../hooks/useManageComponents'
import { ComponentQRModal } from '../components/ComponentQRModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { UTM_LABS } from '@/shared/utils/constants'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Select } from '@/shared/components/ui/Select'
import { Modal } from '@/shared/components/ui/Modal'
import { Table } from '@/shared/components/ui/Table'
import { cn } from '@/shared/utils/cn'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  quantity_total: z.coerce.number().int().min(1, 'Must be at least 1'),
  quantity_available: z.coerce.number().int().min(0, 'Cannot be negative'),
  image_url: z.string().optional(),
  lab_name: z.string().optional(),
}).refine(d => d.quantity_available <= d.quantity_total, {
  message: 'Available cannot exceed total',
  path: ['quantity_available'],
})

const labSelectOptions = [
  { value: '', label: 'None / General Use' },
  ...UTM_LABS.map(lab => ({ value: lab, label: lab })),
]

export default function ManageComponents() {
  const { components, loading, refetch } = useAllComponents()
  const { create, loading: creating } = useCreateComponent()
  const { update, loading: updating } = useUpdateComponent()
  const { remove, loading: deleting } = useDeleteComponent()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [labFilter, setLabFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrTarget, setQrTarget] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const categories = useMemo(() => {
    const cats = [...new Set(components.map(c => c.category).filter(Boolean))].sort()
    return ['All', ...cats]
  }, [components])

  const labsInUse = useMemo(() => {
    const labs = [...new Set(components.map(c => c.lab_name).filter(Boolean))].sort()
    return ['All', ...labs]
  }, [components])

  const filtered = useMemo(() => components.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'All' || c.category === categoryFilter
    const matchLab = labFilter === 'All' || c.lab_name === labFilter
    return matchSearch && matchCat && matchLab
  }), [components, search, categoryFilter, labFilter])

  function openAdd() {
    setEditTarget(null)
    reset({ name: '', description: '', category: '', quantity_total: 1, quantity_available: 1, image_url: '', lab_name: '' })
    setModalOpen(true)
  }

  function openEdit(component) {
    setEditTarget(component)
    reset({
      name: component.name,
      description: component.description ?? '',
      category: component.category ?? '',
      quantity_total: component.quantity_total,
      quantity_available: component.quantity_available,
      image_url: component.image_url ?? '',
      lab_name: component.lab_name ?? '',
    })
    setModalOpen(true)
  }

  async function onSubmit(data) {
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        category: data.category,
        quantity_total: data.quantity_total,
        quantity_available: data.quantity_available,
        image_url: data.image_url || null,
        lab_name: data.lab_name || null,
      }
      if (editTarget) {
        await update(editTarget.id, payload)
        toast.success('Component updated successfully')
      } else {
        await create(payload)
        toast.success('Component added successfully')
      }
      setModalOpen(false)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDelete() {
    try {
      await remove(deleteTarget.id)
      toast.success('Component deleted')
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const columns = [
    {
      key: 'name', label: 'Name',
      render: (v) => <span className="font-medium text-slate-800">{v}</span>,
    },
    {
      key: 'category', label: 'Category',
      render: (v) => <span className="text-slate-600">{v ?? '—'}</span>,
    },
    {
      key: 'lab_name', label: 'Lab',
      render: (v) => <span className="text-slate-500 text-xs">{v ?? '—'}</span>,
    },
    {
      key: 'quantity_available', label: 'Available / Total',
      render: (v, row) => (
        <span className={cn('font-medium tabular-nums', v === 0 ? 'text-red-500' : v < row.quantity_total * 0.25 ? 'text-amber-500' : 'text-green-600')}>
          {v} / {row.quantity_total}
        </span>
      ),
    },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setQrTarget(row)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
            </svg>
            QR
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Components</h1>
        <Button onClick={openAdd}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Component
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search components..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition sm:w-72"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                categoryFilter === cat
                  ? 'bg-[#0D9488] text-white'
                  : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-[#0D9488] hover:text-[#0D9488]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        {labsInUse.length > 1 && (
          <select
            value={labFilter}
            onChange={e => setLabFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition"
          >
            {labsInUse.map(lab => (
              <option key={lab} value={lab}>{lab}</option>
            ))}
          </select>
        )}
      </div>

      <Table columns={columns} data={filtered} loading={loading} emptyMessage="No components found" />

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Component' : 'Add Component'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Optional description"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
            />
          </div>
          <Input label="Category" placeholder="e.g. Sensors, Microcontrollers" {...register('category')} error={errors.category?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Total Quantity" type="number" min={1} {...register('quantity_total')} error={errors.quantity_total?.message} />
            <Input label="Available Quantity" type="number" min={0} {...register('quantity_available')} error={errors.quantity_available?.message} />
          </div>
          <Select label="Associated Lab" options={labSelectOptions} {...register('lab_name')} />
          <Input label="Image URL" placeholder="https://..." {...register('image_url')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating || updating}>
              {editTarget ? 'Save Changes' : 'Add Component'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Component" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong className="text-slate-800">{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Component QR Modal */}
      <ComponentQRModal
        isOpen={!!qrTarget}
        onClose={() => setQrTarget(null)}
        component={qrTarget}
      />
    </div>
  )
}
