// Set this only after the approved, textured, rigged model is present locally
// and its actual idle/walk clip names have been inspected. No missing-asset URL.
// Example shape: { url: './assets/tsukuyo.glb', idleClip: 'Idle', walkClip: 'Walk',
//                  height: 2.2, facingYaw: 0, rootMotionNodes: ['Hips'] }
export const characterConfig = {
  url: './assets/tsukuyo-walk-rigged.glb?rev=20260917-face-reference',
  walkClip: 'Walking',
  height: 2.2,
  // The face geometry is on local +Z, the same axis used by steering.
  facingYaw: 0,
  rootMotionNodes: ['Hips'],
  allowIdleFallback: true,
  // Replace the supplied head with the rebuilt one (tsukuyo-head.mjs).
  refineDetective: true,
  groundFeet: true,
  // Stylized face: preserve the ground shadow without a coarse corridor
  // shadow map turning the small mouth and chin into a dark band.
  receiveShadows: false,
  softenMaterials: true,
  // Preserve the supplied model proportions. The head itself is rebuilt to
  // the character sheet in tsukuyo-head.mjs; enlarging it is not a substitute.
  headScale: 1,
  // Keep the supplied walk, but blend it more gently with the neutral pose.
  walkBlend: .72,
};
