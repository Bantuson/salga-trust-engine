Public dashboard UI refinements
Header title, navbar and report issue CTA are visible on scroll abstracting displayed content, should be only visible at the top of the pages, including mobile view.
Every page I click should always display at top of the page, including clicking footer nav.
change footer Emergency Numbers text color to green with yellow hover

Home page:
create pink tint glossy soft edge card wrapper to View Municipal Performance CTA, replicate from Track service delivery card above it.
How It Works section scroll animation only works once, it should loop and be triggered even if user scrolls back up and down again.
all scroll animations should inverse when scrolling back up.
Ready to see how your municipality performs? section scroll progressive disclosure only shows pink tint when scroll completes creating visibility issues, card tint should appear as scroll animation begins
How it works 3 column card icon + titles should align in one row, for example transparency card eye icon positioned on the top right side and title in top left. Change card background gloss from white to pink matching "Ready to see how your municipality performs?" card.

Home page Mobile view
menu display uses solid pink background, change it to use the skyline as well.
Increase vertical gaps between Header title, Track service delivery card, and view performance CTA as mobile has more vertical breathing room, they look a bit crammed currently.
Add mobile-background-skyline.png as background display on mobile located frontend-public\public\assets\mobile-background-skyline.png

Dashboard page:
Dashboard text in hero header "Municipal Transparency Dashboard" should match color styling as "For Every Citizen." in home page hero.
in the 3 column stats cards change card background gloss from white to pink matching Privacy Notice card.

Dashboard page mobile:
"Geographic Distribution of Reports" card needs better sorting of categories display, looks messy unstructured currently.

About page:
Change card background elements for "What is SALGA Trust Engine?", "How It Works", "For Citizens", "For Municipalities", and "Frequently Asked Questions" from white gloss tint to gloss pink tint.
Remove emojis from How It Works card, ruins professional look.
change the color of the arrow marker/pointers in Frequently Asked Questions card to yellow

My reports page
Change navbar title from my reports to profile
update login card to state "Sign in to access your profile"
update router logic to route to profile endpoint not reports after authentication.

Login card UI
customize title "Sign in to track your reports" per source of click.
if triggered by profile page, "Sign in to access your profile", municipal dashboard "Sign in to access your dashboard", report issue stays the same.
reposition "Sign in to" title to move up a bit more closer to top card border.
Change "sign in with OTP, "register", and "back to email login" from green to yellow.
reposition "Sign in to" title to move up a bit more closer to top card border for send otp card as well.

Municipal dashboard
login card:
add title header Sign in to access your dashboard
change "sign in with OTP, request access text colors to yellow.
change check mark green icons in "Municipal Service Management" card to match public dashboard/about page/For Citizens card check marks.
increase gap between Municipal Service Management card and login card by 50% from current gap.

request access:
Request Municipal Access header not visible
change field label text colors to yellow e.g Municipality Name \* from grey to yellow.
Province selector drop down, looks like 1990, give proper gloss white tint background and ensure text color contrasts background for visibility.
style submit request button exactly like view dashboard cta in in public dashboard/home page/Ready to see how your municipality performs? card. including text color, card wrapper and background light effect.

visual context at
Screenshot 2026-02-14 135533.png
WhatsApp Image 2026-02-14 at 13.22.53 (1).jpeg
WhatsApp Image 2026-02-14 at 13.22.53 (2).jpeg
WhatsApp Image 2026-02-14 at 13.22.53.jpeg
WhatsApp Image 2026-02-14 at 13.42.39.jpeg
