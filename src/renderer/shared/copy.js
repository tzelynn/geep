/* everything geep says. deliberately over-stocked so lines rarely repeat. */
(function (root) {
  const LINES = {
    prep: [
      'psst. teeth. now.',
      'go wash your face, you gremlin 🫧',
      'water bottle. fill it. i am watching.',
      'lay out tomorrow\'s clothes, future you says hi',
      'plug your phone in somewhere Far Away',
      'one (1) skincare step. that\'s the deal.',
      'take your contacts out!! blink!!',
      'the dishes can wait. your face cannot.',
      'shower thoughts > doomscroll thoughts'
    ],
    persist: [
      'you did NOT do it. i can tell.',
      'i will simply stay here. forever. :)',
      'still not brushed. still not brushed.',
      'this panel grows. it is my nature.',
      'blink twice if the toothbrush is dry',
      'i moved. i will keep moving. hi.',
      'sleep prep: [ ] pending. rude.',
      'you have a whole bathroom right there'
    ],
    disrupt: [
      'ok. closing time. log off.',
      'save your work, we are winding down',
      'i am about to start clicking things',
      'the show will still exist tomorrow',
      'wrap it up wrap it up wrap it up',
      'your mouse feels heavy, doesn\'t it',
      'ctrl+s. then bed.',
      'nothing good happens on the internet now'
    ],
    peak: [
      'BED. NOW. i am not negotiating.',
      'the computer is closed for the night 🌙',
      'you can quit me. we both know you won\'t.',
      'tomorrow-you is begging. begging!',
      'this is the part where you stand up',
      'goodnight. GOODNIGHT. 😊',
      'i have muted everything. it\'s quieter here.'
    ],
    prepdone: [
      'prep done ✓ good gremlin',
      'look at you, all ready for bed',
      'teeth: sparkling. me: proud.'
    ],
    quiet: [
      'five minutes. i am counting.',
      'snoozed. tick tock.',
      'okay okay. briefly.'
    ],
    goodnight: [
      'goodnight 🌙',
      'sleep well, gremlin',
      'see you tomorrow ✨'
    ],
    idle: [
      'evening plans: sleep, eventually',
      'i\'ll be back at T-45'
    ]
  }

  const DONE_LABELS = ['done ✓', 'all done!', 'i did it', 'teeth: brushed', 'yes mum']
  const SNOOZE_LABELS = ['5 more mins', 'in a bit…', 'soon™', 'not yet 😖']
  const BED_LABELS = ['okay, goodnight 😴', 'fine. bed.', 'you win 🌙', 'going, going…']

  // deterministic-ish pick that still feels random between beats
  function pick (list, seed) {
    if (!list || !list.length) return ''
    const s = Math.abs(Math.floor(seed))
    return list[s % list.length]
  }

  root.GEEP_COPY = { LINES, DONE_LABELS, SNOOZE_LABELS, BED_LABELS, pick }
})(window)
