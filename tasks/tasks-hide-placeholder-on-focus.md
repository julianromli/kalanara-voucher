## Relevant Files

- `components/ui/input.tsx` - Input component yang perlu dimodifikasi untuk hide placeholder on focus

### Notes

- Pure CSS solution menggunakan Tailwind classes
- Tidak perlu JavaScript atau state management
- Perubahan akan berlaku untuk semua input di aplikasi

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 1.0 Add focus placeholder hide class to Input component
  - [x] 1.1 Open `components/ui/input.tsx`
  - [x] 1.2 Add `focus:placeholder:text-transparent` class to the className string
  - [x] 1.3 (Optional) Add `placeholder:transition-opacity` for smooth transition effect
- [x] 2.0 Verify TypeScript compilation
  - [x] 2.1 Run `bunx tsc --noEmit` to check for type errors
  - [x] 2.2 Fix any errors if found
- [ ] 3.0 Test in browser
  - [ ] 3.1 Open any page with input fields (e.g., checkout form, login page)
  - [ ] 3.2 Verify placeholder is visible when input is not focused
  - [ ] 3.3 Click/tap on input and verify placeholder disappears immediately
  - [ ] 3.4 Click away (blur) and verify placeholder reappears if input is empty
- [ ] 4.0 Commit changes
  - [ ] 4.1 Stage changes: `git add components/ui/input.tsx`
  - [ ] 4.2 Commit with message: `fix: hide input placeholder on focus`
