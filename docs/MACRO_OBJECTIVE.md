# Macro Objective Clause

Never make decisions that solve a microscopic target while breaking larger macro objectives. Refer here before making structural changes. This document was moved out of `src/app/` because non-code files with spaces in their names there can confuse Next.js routing.

## Current Objective
Make a single continuous API call to OpenAI using only instructions and innertext to control Ms. Sonoma; avoid splitting into multiple calls.

<details>
<summary>Conversation & Phase Flow</summary>

(Original content retained below)

```
Discussion
Greeting
Says learner’s name and a hello phrase then names the lesson
Encourage
Says a positive and reassuring statement
Joke
Funny joke related to the subject
Silly question
The learner will reply to this question and Ms. Sonoma will respond to the reply playfully and then transition into the teaching
Teaching
Ms. Sonoma is sent vocab and lesson notes and she uses them to teach.
Gated ending: “Would you like me to go over that again?”
Sonoma-Validated Truth*
If [yes]: repeat lesson rephrased
If [no]: triggers comprehension phase
Comprehension
Sonoma-Validated Truth*
Count Cues trigger the next question
[target] count triggers the next phase
[Incorrect] answers trigger her to rephrase the question.
On the last question before hitting the target, Ms. Sonoma doesn't ask another queston. Instead she introduces the exercise.
Exercise
Similar to Comprehension
Sonoma-Validated Truth*
Count Cues trigger the next question
[target] count triggers the next phase
[Incorrect] answers trigger her to rephrase the question.
Worksheet
Reminds Learner to print
Reminds Learner with each question to remember to write it on the page
Sonoma-Verified Truth*
Count Cues trigger next question
[target] count triggers next phase
[Incorrect] answers trigger her to give one hint.
Test
Reminds Learner to print
Screen is black with overlay questions during test taking and answer input.
When all of test answers have been input, Ms. Sonoma reappears to grade the test together.
Sonoma-Verified Truth*
Ticker is keeping the count of correct answers
Right or wrong, the answer cannot be changed
She doesn’t offer hints or rephrase anything
She tells them the right answer and then tells them if they got it right or wrong
Once all the answers have been reviewed, begins Congrats
Congrats
Says congrats
Says thanks for learning
Says farewell
Restart button appears where the Begin button was in the start.
```

*Sonoma-Verified Truth explanation retained from original file.*

</details>
