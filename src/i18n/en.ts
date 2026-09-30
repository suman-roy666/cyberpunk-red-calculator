/**
 * @file en.ts
 * @description This file contains the English translations for the application.
 **/

export const en = {
  common: {
    commonLanguage: "Language",
  },
  character: {
    loadingSheet: "Initializing...",
    createCharacterPageHeading: "Create your character",
    createCharacterSubheading: "Assign your STAT and SKILL points. Any unused STAT points are lost after character creation. Use 'em or lose 'em.",
    identityHeading: "Identity",
    characterPortraitAlt: "Character portrait",
    characterNamePlaceholder: "Character name",
    characterRolePlaceholder: "Select a Role",
    playerLabel: "Player",
    playerNamePlaceholder: "Player name",
    photoUrlLabel: "Character image URL",
    photoUrlPlaceholder: "Paste the image URL...",
    applyImageButton: "Apply",
    statsHeading: "STATs",
    skillsHeading: "Skills",
    skillsHelp: "The 13 Basic Skills start at level 2: 26 points are already taken from your 86 starting points, leaving 60 free points. x2 Skills cost 2 Skill points per level.",
    sheetValid: "Your character is ready to run the edge.",
    sheetInvalid: "Fix the issues above to create your character.",
    randomAllocateButton: "Randomize allocation",
    createCharacterButton: "Create character",
  },
  sheets: {},
  combat: {},
  dice: {},
  gm: {},
};

export type UIStrings = typeof en;