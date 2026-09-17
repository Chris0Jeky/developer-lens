export async function loadShareStudio() {
  const module = await import('./components/ShareStudio')
  return { default: module.ShareStudio }
}

export async function loadWrappedExperience() {
  const module = await import('./components/WrappedExperience')
  return { default: module.WrappedExperience }
}
