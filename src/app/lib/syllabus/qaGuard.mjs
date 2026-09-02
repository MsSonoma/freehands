export const SYLLABUS_QA_SERVER_FLAG = 'SYLLABUS_QA_ENABLED'
export const SYLLABUS_QA_PUBLIC_FLAG = 'NEXT_PUBLIC_SYLLABUS_QA_ENABLED'

export function isSyllabusQaEnabled(env = process.env) {
  return env?.NODE_ENV !== 'production'
    && env?.[SYLLABUS_QA_SERVER_FLAG] === 'true'
    && env?.[SYLLABUS_QA_PUBLIC_FLAG] === 'true'
}
