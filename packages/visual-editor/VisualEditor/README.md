# Visual editor
VisualEditor je React komponenta pro vizuální úpravu HTML a CSS. Umožňuje uživatelům přímo upravovat obsah v editoru a synchronizovat změny s rodičovskou komponentou.

## Install
```Bash
npm install 
cd VisualEditor
npm run dev
``` 

##
```Typescript
 <VisualEditor
      content={task.editableHtml}
      setContent={(val: any) =>
        onTaskChange(
          "editableHtml",
          typeof val === "function" ? val(task.editableHtml) : val
        )
      }
      cssContent={task.editableCss}
      setCssContent={(val: any) =>
        onTaskChange(
          "editableCss",
          typeof val === "function" ? val(task.editableCss) : val
        )
      }
      isDark={isDark} 
    />
```

## Demo
