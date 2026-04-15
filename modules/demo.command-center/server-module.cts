const demoCommandCenterServerModule = {
  profiles: {
    content: [
      {
        id: "demo.command-center.content",
        defaults: {
          mapId: "world-classic"
        }
      }
    ],
    gameplay: [
      {
        id: "demo.command-center.gameplay",
        defaults: {
          ruleSetId: "classic-defense-3",
          diceRuleSetId: "defense-3",
          victoryRuleSetId: "majority-control"
        }
      }
    ],
    ui: [
      {
        id: "demo.command-center.ui",
        defaults: {
          themeId: "ember",
          pieceSkinId: "command-ring"
        }
      }
    ]
  }
};

export = demoCommandCenterServerModule;
