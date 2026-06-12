# Web Interaktive Visual editor for HTML and CSS
This project is a web-based interactive visual editor for editing HTML and CSS.  
It allows users to modify elements, attributes, and styles in a user-friendly interface.
##  Project Structure
### VisualEditor
Web-based interactive visual editor for HTML and CSS.  
Allows editing HTML structure, attributes, and CSS styles visually.

#### Usage 
```bash
cd VisualEditor
npm install
npm run dev
```

### generate_children_elements_attributes
Scripts for generating rules for HTML elements and their attributes.
Used to maintain the list of valid tags and attribute options for the editor.

#### Usage 
```bash
cd generate_children_elements_attributes
npm install
node generate_tag_children.js
```

### Frontend TODO prejmenovat
Frontend application (currently under development).
Handles UI, interactions, and integration with the visual editor backend.

#### Usage 
```bash
cd frontend
npm install
npm run dev
```

## Technologies
- React
- TypeScript
- Vite
- Tailwind CSS