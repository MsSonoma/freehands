import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const route = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/route.js'), 'utf8')
const experience = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')

test('Liftoff model contract requires deterministic problem identity', () => {
  assert.match(route, /deterministic instanceKey/)
  assert.match(route, /same underlying quantities and relationships must use the same instanceKey/i)
  assert.match(route, /problem": \{ "prompt":/)
})

test('diagnostic problem actions are freshness-gated by the application', () => {
  assert.match(route, /PROBLEM_ACTIONS = new Set\(\['probe', 'reprobe', 'isolate', 'integrate'\]\)/)
  assert.match(route, /validateProblemActionFreshness/)
  assert.match(route, /isLiftoffProblemFresh\(problem, priorProblems\)/)
  assert.match(route, /missing_problem_identity/)
  assert.match(route, /repeated_problem/)
})

test('Liftoff generation asks one response target without a brittle compound-question rejection gate', () => {
  assert.match(route, /Every Liftoff learner problem must ask for exactly ONE response target/)
  assert.doesNotMatch(route, /multiple_learner_demands|compoundDemand/)
})

test('duplicate model problems are regenerated and eventually fail closed', () => {
  assert.match(route, /retryForDifferentProblem/)
  assert.match(route, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/)
  assert.match(route, /could not generate a genuinely different diagnostic problem/)
  assert.match(route, /Rewording the same quantities or relationships is still the same problem/)
})

test('learner sees the validated structured problem rather than trusting problem text embedded in feedback', () => {
  assert.match(route, /learnerMessage contains feedback or teaching only/)
  assert.match(route, /composeLearnerMessage/)
  assert.match(route, /action\.problem\.prompt/)
})

test('initial Liftoff state records the modeled problem before the first probe', () => {
  assert.match(experience, /priorProblems: init\.modeledProblem \? \[init\.modeledProblem\] : \[\]/)
})


test('question-bound judgment contract is enforced by the application', () => {
  assert.match(route, /responseContract:\{targetComponentId,demandType,criterion\}/)
  assert.match(route, /question_requires_one_target/)
  assert.match(route, /missing_response_contract/)
  assert.match(route, /response_contract_target_mismatch/)
  assert.match(route, /validateLiftoffEvidenceAgainstDemand/)
  assert.match(route, /retryForFairTurn/)
  assert.match(route, /payload\.evidenceValidated = true/)
})
