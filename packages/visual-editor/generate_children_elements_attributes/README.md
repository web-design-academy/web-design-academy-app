# Generating HTML children elements and their attributes

This script generates a structured JSON file containig:  

- all HTML tags
- allowed child elements (based on valis HTML nesting rules)
- supported HTML attributes per elements

The output is written to **tags.json**

## Data Sources
The script uses:

- **html-tags**- list of allstandard HTML tags
- **html-elements-attributes**- mapping of HTML elements to allowed attributes
- **validate-html-nesting**- validation of allowed parent/child relationships

## What is Generated
Each tag has the following structure:

```json
{
  "name": "div",
  "children": ["span", "text"],
  "attributes": ["id", "class"]
}
```
where

- name - name of element
- children- children of elememt
- attributest - attributes of element

## How to Run
Make sure dependencies are installed
```bash
npm install
```

Run generator
```bash
node generate_tag_children.js
```

After running, a file will be created:
```bash
tags.json
```
