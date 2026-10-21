// Everything the site shows lives here. Edit this file to update the site.
// Source: David's "PandP Fall 26" Google Doc.
//
// Songs:  lead = who leads it, key = key it's played in, chart = path or link to the
//         chord chart (leave "" until it's ready), sections = arrangement in order.
//         A section can be a plain string or { name, note, dynamics }.
//         sheet = optional published chord sheet (chords only, no lyrics: the site is public).
// Sets:   roles list who is on what. "(g)" after a vocalist = sings while playing guitar,
//         "(?)" = not confirmed, "(3–4)" = only on those songs of the set.
//         A song's players = lineup changes for that song, shown on its row and sheet.

window.PANDP = {
  title: "Praise & Prayer",
  term: "Fall 2026",
  theme: "Overflow",
  subtitle: "Filled by the Spirit to Walk in the Truth",
  verse: {
    ref: "John 21:15–17 (NIV)",
    text: [
      "When they had finished eating, Jesus said to Simon Peter, “Simon son of John, do you love me more than these?” “Yes, Lord,” he said, “you know that I love you.” Jesus said, “Feed my lambs.”",
      "Again Jesus said, “Simon son of John, do you love me?” He answered, “Yes, Lord, you know that I love you.” Jesus said, “Take care of my sheep.”",
      "The third time he said to him, “Simon son of John, do you love me?” Peter was hurt because Jesus asked him the third time, “Do you love me?” He said, “Lord, you know all things; you know that I love you.”"
    ]
  },

  schedule: [
    { when: "Saturdays", what: "Practice, 7–10 PM", detail: "Set 1: 7–8 · Set 2: 8–9 · Set 3: 9–10" },
    { when: "Thu, Nov 5", what: "Full rehearsal", detail: "" }
  ],

  todo: [
    "Announce P&P theme + schedule",
    "Each set makes their practice schedule",
    "Check 2 guitars with amp",
    "Check mic #s and cables",
    "Thursday Nov 5 rehearsal",
    "Slides and sound people",
    "Set 1 songs",
    "Set 2 songs",
    "Set 3 songs"
  ],

  sets: [
    {
      id: "set-1",
      name: "Set 1",
      title: "Accepting Jesus and His Presence",
      practice: "Saturdays 7–8 PM",
      roles: [
        ["Guitar", ["Nathan", "David"]],
        ["Vocals", ["David (g)", "Nathan (g)", "Becky", "Ann"]],
        ["Piano", ["Joanne"]],
        ["Bass", ["Matthew"]],
        ["Cajon", ["Doyoon"]],
        ["Sound", ["Anderson"]],
        ["Slides", []]
      ],
      songs: [
        {
          title: "Rest On Us", artist: "Maverick City", lead: "Nathan", key: "A",
          chart: "",
          sections: ["Verse 1", "Verse 1", "Chorus", "Turnaround", "Verse 2", "Verse 2", "Verse 2",
                     "Chorus", "Chorus", "Bridge (chords)", { name: "Bridge", note: "x3" }, "Chorus"]
        },
        {
          title: "At The Altar", artist: "Elevation Rhythm", lead: "David", key: "A♭",
          chart: "",
          sections: [
            "Intro", "Verse 1",
            { name: "Chorus", note: "Start on A♭, not A♭/C" },
            { name: "Instrumental", note: "A♭ D♭ A♭ D♭" },
            "Verse 2", "Chorus", "Tag",
            { name: "Bridge 1", note: "2x, straight in. 2nd time: B♭m instead of Fm. Last “He can use anything, sit back and watch Him”: drop the A♭/C" },
            "Tag", "Vamp 1",
            { name: "Vamp 2a", note: "3rd line: Fm instead of A♭/C" },
            "Vamp 2b", "Bridge 2", "Tag"
          ]
        },
        {
          title: "Set a Fire → Make Room", artist: "Jesus Culture → Community Worship", lead: "Becky → Ann", key: "E",
          chart: "",
          note: "Go into prayer: repeat the chorus chords while set members swap. Repeat the chorus before moving into Set 2.",
          sections: ["Chorus", { name: "Verse", note: "2x" }, "Chorus", { name: "Chorus chords", note: "“I want more” 2x" },
                     { name: "Make Room Chorus", note: "Transition into Make Room" }, "Verse", { name: "Chorus", note: "2x" },
                     "Instrumental", { name: "Bridge", note: "4x" }, "Chorus", "Ending"]
        }
      ]
    },
    {
      id: "set-2",
      name: "Set 2",
      title: "Setting Your Eyes on Jesus",
      subtitle: "Ask Him to overflow in you",
      practice: "Saturdays 8–9 PM",
      roles: [
        ["Guitar", ["David", "Matthew"]],
        ["Vocals", ["Matthew (g)", "Millou", "Alex", "Becky"]],
        ["Piano", ["Amy (1–2)", "Anderson (3–4)"]],
        ["Cello", ["Amy (3–4)"]],
        ["Bass", ["Elliot"]],
        ["Cajon", ["Nathan"]],
        ["Sound", []],
        ["Slides", []]
      ],
      songs: [
        { title: "Nothing Else", artist: "Cody Carnes", lead: "Alex", key: "A♭", confirmed: true, chart: "",
          sections: ["Chorus", "Verse 1", "Verse 2", "Chorus", { name: "Bridge", note: "4x" }, "Chorus"] },
        { title: "Center", artist: "Bethel Music", lead: "Matthew", key: "B", confirmed: true, chart: "",
          sections: ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus 2", "Tag 1A", { name: "Bridge 1A", note: "2x" },
                     { name: "Tag 1B", note: "2x. 2nd time: F♯ instead of D♯m at the end" }, { name: "Bridge 1B", note: "2x" }, "Chorus", "Tag 2"] },
        { interlude: "Prayer time" },
        { title: "Turn Your Eyes", artist: "Hillsong", lead: "Millou", key: "D", confirmed: true, chart: "", sections: [],
          players: "Anderson on keys · Amy on cello" },
        { title: "Be Thou My Vision", artist: "Shane & Shane", lead: "Becky", key: "D → E", note: "Key change from D to E.", chart: "", sections: [],
          players: "Anderson on keys · Amy on cello" }
      ]
    },
    {
      id: "set-3",
      name: "Set 3",
      title: "Praising God for Who He Is",
      practice: "Saturdays 9–10 PM",
      roles: [
        ["Guitar", ["David", "Nathan"]],
        ["Vocals", ["David (g)", "Nathan (g)", "Millou", "Alex"]],
        ["Piano", ["Joanne"]],
        ["Cello", ["Amy"]],
        ["Bass", ["Matthew"]],
        ["Cajon", ["Doyoon"]],
        ["Electric", ["Anderson (?)"]],
        ["Sound", ["Anderson (?)"]],
        ["Slides", []]
      ],
      songs: [
        { title: "In Christ Alone", artist: "Keith Getty", lead: "Nathan", key: "G", chart: "", sections: ["Verse", "Chorus", "Verse", "Chorus"] },
        { title: "We Crown You", artist: "Jeremy Riddle", lead: "Alex", key: "A♭", chart: "", sections: [] },
        { title: "Jesus Be the Name", artist: "Elevation Worship", lead: "David", key: "A♭", chart: "",
          sections: ["Verse 1", "Chorus 1", "Verse 2", "Chorus 1", "Instrumental 1", "Bridge", "Chorus 2", "Chorus 3", "Chorus 4"] },
        { title: "You Are My All in All", artist: "Dennis Jernigan", lead: "David", key: "A♭", chart: "", sections: [] },
        { title: "Yet Not I but Through Christ in Me", artist: "CityAlight", lead: "Millou", key: "D♭", chart: "", sections: ["Verse 1", "Verse 2", "Verse 3", "Verse 4"] }
      ]
    }
  ]
};
