# Certificate template

To use your own certificate layout, edit **`certificate.json`** in this folder.

## Placeholders

Use these in your template (in `text` or `footer`, or via `placeholder` in blocks):

| Placeholder      | Replaced with        |
|------------------|----------------------|
| `{{organization}}` | Organization name   |
| `{{title}}`        | Certificate title   |
| `{{studentName}}`   | Student name        |
| `{{courseName}}`   | Course name         |
| `{{certificateId}}`| Certificate ID      |
| `{{issuedDate}}`   | Issue date (locale)  |

## Block format

Each item in `blocks` can be:

- **Static text with placeholders**: use `"text": "Some text {{studentName}} more text"`.
- **Label + placeholder**: use `"label": "Certificate ID: "`, `"placeholder": "certificateId"`.
- **Label + placeholder + suffix**: add `"text": " has completed."` so the line becomes `label + value + text`.

Example block:

```json
{
  "type": "text",
  "label": "This is to certify that ",
  "placeholder": "studentName",
  "text": " has completed the course.",
  "fontSize": 12,
  "align": "center",
  "marginBottom": 8
}
```

## Options

- **size**: `"A4"` or `"letter"`
- **margin**: number (points, default 72)
- **organization**, **title**: used for `{{organization}}` and `{{title}}`
- **footer**: optional line at bottom (e.g. `"Verify at: /verify/{{certificateId}}"`)

If `certificate.json` is missing or invalid, the built-in default layout is used.
