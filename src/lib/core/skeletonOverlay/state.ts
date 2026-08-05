import { useEffect, useState } from 'react'

export const useSkeletonOverlayState = (enableSkeleton = false) => {
  const [showSkeletonOverlay, setShowSkeletonOverlay] = useState(enableSkeleton)

  useEffect(() => {
    if (enableSkeleton) {
      setShowSkeletonOverlay(true)

      return
    }

    const skeletonHideTimeout = setTimeout(
      () => setShowSkeletonOverlay(false),
      200,
    )

    return () => {
      clearTimeout(skeletonHideTimeout)
    }
  }, [enableSkeleton])

  return { showSkeletonOverlay }
}
