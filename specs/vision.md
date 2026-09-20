## geep vision

geep is a desktop app that nudges you to go to sleep at a pre-set time, with increasing aggressiveness. the app will be installed on a macbook.

## core functionality

1. weekly sleep schedule
    - set desired sleep times for each day of the week
    - allow for exceptions for certain specific days, while keeping the regular weekly sleep schedule intact unless otherwise stated
2. sleep reminders
    - 45 mins before the sleep time, start sending nudges to go prepare to sleep (e.g. brush teeth, etc)
        - this can be dismissed as done or snoozed for 5 minutes
    - 30 mins before sleep time, if the sleep preparation has not been marked as done, persist on the screen until it is marked as done
        - progressively get more aggressive in the reminder
    - 20 mins before sleep time, disrupt the PC user experience by aggresively nudging the user to log off
        - the peak should occur 10 mins before sleep time, and the PC should be unusable unless the user quits the app

disruption ideas:
- the sleep-prep reminders should take up space on the screen so that it disrupts the PC usage
- the nudges to log off can start to disrupt more functionality by blocking mouse clicks or muting the volume (if watching show)


## design principles

- cute and aesthetic design
- the aggresion should be cute and funny
- the design should involve different characters (in rotation) such that every day is a bit different
    - the characters will be drawn and provided as svg after the initial development is done, given that there will be more direction on how the design should look them
    - you may generate and use placeholder characters that fit the vibe first
- will be good to have a bit of 'never-let-them-guess-your-next-move' vibe
