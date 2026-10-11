'use client'

import { forwardRef } from 'react'

import { reviewTeacherConfig } from '@/app/lib/reviewTeacher.js'
import { reviewTeacherDesign } from '@/app/lib/reviewTeacherDesign.mjs'

export const REVIEW_TEACHER_VIDEO_MAX_WIDTH = 600

const ReviewTeacherVideoStage = forwardRef(function ReviewTeacherVideoStage({
  teacher = 'slate',
  style: extraStyle = null,
}, ref) {
  const config = reviewTeacherConfig(teacher)
  const design = reviewTeacherDesign(teacher)

  return (
    <div
      data-review-teacher-video-stage={teacher}
      style={{
        width: `min(${REVIEW_TEACHER_VIDEO_MAX_WIDTH}px, calc(100% - 32px))`,
        aspectRatio: '16 / 9',
        flex: '0 0 auto',
        margin: '12px auto 0',
        overflow: 'hidden',
        background: design.videoBackground,
        borderRadius: design.videoRadius,
        boxShadow: design.videoShadow,
        ...extraStyle,
      }}
    >
      <video
        ref={ref}
        src={config.video}
        loop
        muted
        playsInline
        preload="auto"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: design.videoObjectFit,
          objectPosition: design.videoObjectPosition,
        }}
      />
    </div>
  )
})

export default ReviewTeacherVideoStage
