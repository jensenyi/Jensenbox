window.CONTENT_FACTORY_STATE = {
  generatedAt: "2026-07-03T00:00:00+08:00",
  latestRun: {
    run_id: "DEMO-LOCAL",
    run_date: "2026-07-03",
    status: "DEMO",
    human_gates: {
      idea_selection: false,
      publish_approval: false,
      performance_data: false
    },
    artifacts: {
      input: null,
      research: null,
      competitor: null,
      ideas: null,
      selected_ideas: null,
      scripts: [],
      visuals: [],
      quality_report: null,
      geo_assets: [],
      publish_plan: null,
      review: null
    },
    errors: []
  },
  ui: {
    enabled: true,
    url: "http://127.0.0.1:4175/",
    externalModelConnected: false,
    modelLabel: "Local demo",
    modelName: "local"
  },
  modules: [
    { code: "RS", name: "Research Signals", role: "Signals and topic opportunities", thread: "local-demo" },
    { code: "SW", name: "Script Workshop", role: "Scripts, hooks, and platform versions", thread: "local-demo" },
    { code: "CW", name: "Creative Workshop", role: "Image and video creative assets", thread: "local-demo" },
    { code: "AR", name: "Assets and Review", role: "Distribution, assets, and review", thread: "local-demo" }
  ]
};
