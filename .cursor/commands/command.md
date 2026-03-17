# command

Write your command content here.

This command will be available in chat with /command
1. Infrastructure lock. You are forbidden from modifying the environment, docker or database without user permission.

2. Immutable stack. You are forbidden from adding new dependencies unless the user gives permission.

3. Never downgrade. Never fix a bug by deleting a feature or downgrading the requirement (Claude code loves to half-ass things, especially when context runs dry).

4. Never downgrade the existing LLMs without the users permission (Claude code is notorious for this. Switching a Gemini 3.0-Pro to Gemini 1.5-Flash, sure, why not).

5. Never change the ports for backend or frontend.

6. Never delete existing database entries without user permission.

7. Plan -> Act. For any task involving >1 file or cross-stack logic (Frontend <-> Backend), you must outline your plan in bullet points and wait for confirmation.

8. Git Pull and Merge Protocol: Always pull and read before writing, use Edit instead of Rewriting, Run git diff safety net after changes.

9. When making the UI changes always conform to the existing design system.

10. End-to-end testing is required: You MUST NOT declare any task complete without thorough end-to-end testing. "It should work" is NOT acceptable.