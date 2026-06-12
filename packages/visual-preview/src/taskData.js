export const centerBoxTask = {
  id: 'task-button-design',
  title: 'Dizajn Moderného Tlačidla',
  instructions: `
    <h3>Cieľ:</h3>
    <p>Vytvor moderné tlačidlo a vycentruj ho do stredu obrazovky pomocou Gridu. Riaď sa kontrolným zoznamom úloh nižšie.</p>
  `,
  initialHtml: `
    <div class="wrapper">
      <button class="btn active" id="moje-tlacidlo">Klikni na mňa</button>
    </div>
  `,
  initialCss: `
body { margin: 0; }
.wrapper {
    height: 100vh;
    /* 1. Nastav Grid na vycentrovanie */
    
}

.btn {
    /* 2. Naštýluj tlačidlo sem */
    
}
  `,
  solutionCss: `
.wrapper {
    display: grid;
    place-items: center;
}
.btn {
    padding: 10px 20px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}
  `,
  targetSelectors: ['.wrapper', '.btn'],
  lockedLines: [],
  hintTimeout: 2000,
  
   checks: [
    {
      id: 'check-grid', 
      type: 'exact-match',
      selector: '.wrapper', 
      property: 'display',
      value: 'grid',
      level: 'error',
      message: 'Rodič musí používať display: grid.',
      studentHint: 'Rodič (wrapper) musí využívať technológiu Grid' 
    },
    {
      id: 'check-cursor', 
      type: 'required-property',
      selector: '.btn',
      property: 'cursor',
      level: 'error',
      message: 'Nezabudni nastaviť kurzor na pointer!',
      studentHint: 'Tlačidlo reaguje zmenou kurzora po prejdení myšou' 
    },
    {
      id: 'check-border', 
      type: 'forbidden-value',
      selector: '.btn',
      property: 'border',
      value: 'solid', 
      level: 'warning',
      message: 'Učiteľ neodporúča používať klasický okraj (border). Použi radšej border: none.'
    },
    {
      id: 'check-bg-color', 
      type: 'regex-match',
      selector: '.btn',
      property: 'background-color',
      value: '^(#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})|rgba?\\(.*\\))$', 
      level: 'warning',
      message: 'Farba pozadia musí byť HEX alebo RGB formát. Nepoužívaj názvy (red, blue).',
      studentHint: 'Použi pokročilý formát zápisu farby (HEX alebo RGB)' 
    },
    {
      id: 'check-padding', 
      type: 'min-count',
      selector: '.btn',
      property: 'padding',
      value: 1,
      level: 'recommendation',
      message: 'Tlačidlo bez paddingu nevyzerá dobre. Pridaj vnútorné odsadenie.',
      studentHint: 'Tlačidlo dýcha vďaka vnútornému odsadiu' 
    }
  ]
};