'use client'
import { useState, useMemo, useEffect } from 'react'
import { Search, X, Plus, Sparkles } from 'lucide-react'
import { SKILL_CATEGORIES, ALL_SKILLS, suggestCategoriesForTitle, getCategoryForSkill } from '@/lib/skill-master'

interface Props {
  selected:    string[]
  onChange:    (skills: string[]) => void
  jobTitle?:   string   // used to auto-suggest the best category
}

export default function SkillPicker({ selected, onChange, jobTitle = '' }: Props) {
  const [activeCategory, setActiveCategory] = useState('elv')
  const [searchText,     setSearchText]     = useState('')
  const [customSkill,    setCustomSkill]    = useState('')

  // When the job title changes, auto-switch to the most relevant category
  useEffect(() => {
    if (jobTitle.length >= 3) {
      const suggested = suggestCategoriesForTitle(jobTitle)
      if (suggested.length > 0) setActiveCategory(suggested[0])
    }
  }, [jobTitle])

  function toggle(skill: string) {
    if (selected.includes(skill)) {
      onChange(selected.filter(s => s !== skill))
    } else {
      onChange([...selected, skill])
    }
  }

  function addCustom() {
    const trimmed = customSkill.trim()
    if (!trimmed || selected.includes(trimmed)) return
    onChange([...selected, trimmed])
    setCustomSkill('')
  }

  // Skills shown in the active category panel (filtered by search if any)
  const displayedSkills = useMemo(() => {
    if (searchText.trim().length >= 1) {
      // Search across ALL categories
      return ALL_SKILLS.filter(s =>
        s.toLowerCase().includes(searchText.toLowerCase()) && !selected.includes(s)
      ).slice(0, 30)
    }
    const cat = SKILL_CATEGORIES.find(c => c.id === activeCategory)
    return (cat?.skills || []).filter(s => !selected.includes(s))
  }, [activeCategory, searchText, selected])

  const activeCat = SKILL_CATEGORIES.find(c => c.id === activeCategory)

  return (
    <div className="space-y-3">

      {/* Selected skills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[44px]">
          {selected.map(skill => {
            const cat = getCategoryForSkill(skill)
            return (
              <span key={skill}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${cat?.color || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {skill}
                <button type="button" onClick={() => toggle(skill)}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition">
                  <X size={10}/>
                </button>
              </span>
            )
          })}
          <button type="button" onClick={() => onChange([])}
            className="text-xs text-gray-400 hover:text-red-500 transition ml-auto self-center">
            Clear all
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search skills across all categories…"
          className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
        {searchText && (
          <button type="button" onClick={() => setSearchText('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13}/>
          </button>
        )}
      </div>

      {/* Category tabs — hidden when searching */}
      {!searchText && (
        <div className="flex gap-1 flex-wrap">
          {SKILL_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                activeCategory === cat.id
                  ? cat.color + ' shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 bg-white'
              }`}>
              <span>{cat.emoji}</span> {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Skills grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        {searchText ? (
          <p className="text-xs text-gray-400 mb-2 font-medium">
            {displayedSkills.length} results for "{searchText}"
          </p>
        ) : (
          <p className="text-xs text-gray-400 mb-2 font-medium">
            {activeCat?.emoji} {activeCat?.label} — click to add
          </p>
        )}

        {displayedSkills.length === 0 && (
          <p className="text-xs text-gray-400 py-3 text-center">
            {searchText ? 'No skills found — add it as a custom skill below' : 'All skills in this category are already selected'}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {displayedSkills.map(skill => (
            <button
              key={skill}
              type="button"
              onClick={() => toggle(skill)}
              className="flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full hover:border-red-400 hover:text-red-700 hover:bg-red-50 transition font-medium">
              <Plus size={10}/> {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Custom skill input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customSkill}
          onChange={e => setCustomSkill(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Add a custom skill not in the list…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
        <button
          type="button"
          onClick={addCustom}
          disabled={!customSkill.trim()}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 transition disabled:opacity-40">
          <Plus size={13}/> Add
        </button>
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">{selected.length} skill{selected.length > 1 ? 's' : ''}</span> selected — these will be used for AI candidate matching and sourcing queries
        </p>
      )}
    </div>
  )
}
