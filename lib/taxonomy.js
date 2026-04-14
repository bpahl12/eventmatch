export const TAXONOMY = [
  'Hotel development',
  'Real estate development',
  'General contracting',
  'Architecture',
  'Interior design',
  'Construction financing',
  'Hospitality operations',
  'Restaurant operations',
  'Food & beverage',
  'Retail leasing',
  'Commercial real estate',
  'Property management',
  'Venture capital',
  'Angel investing',
  'Private equity',
  'Family office',
  'Investment banking',
  'Wealth management',
  'Legal — corporate',
  'Legal — real estate',
  'Legal — IP',
  'Accounting & tax',
  'Software engineering',
  'Product management',
  'Product design',
  'Brand & marketing',
  'Performance marketing',
  'PR & communications',
  'Sales leadership',
  'Business development',
  'Recruiting & talent',
  'HR & operations',
  'Executive coaching',
  'AI / machine learning',
  'Data & analytics',
  'Fintech',
  'Healthtech',
  'Proptech',
  'Consumer brands',
  'E-commerce',
  'Manufacturing',
  'Supply chain',
  'Logistics',
  'Media & content',
  'Film & production',
  'Music industry',
  'Fashion',
  'Events & experiential',
  'Nonprofit & philanthropy'
]

export const scoreMatch = (myLookingFor = [], theirCanOffer = [], theirLookingFor = [], myCanOffer = []) => {
  const set = arr => new Set(arr || [])
  const a = set(myLookingFor), b = set(theirCanOffer)
  const c = set(theirLookingFor), d = set(myCanOffer)
  let score = 0
  for (const x of a) if (b.has(x)) score += 2
  for (const x of c) if (d.has(x)) score += 1
  return score
}
