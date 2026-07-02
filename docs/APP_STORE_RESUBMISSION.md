# App Store — Charles step-by-step (no jargon)

Apple needs a VIDEO of you deleting an account in the app. Everything else is already built.

---

## PART A — Make a throwaway test account (2 minutes)

You will delete THIS account in the video. Never use appreview@gatorvaultinsider.com.

1. On your iPhone, open **GatorVault Insider**
2. If signed in, sign out (Menu if available, or delete app data — or just use a fresh email)
3. Tap **Join** or **Sign up**
4. Use a fake email you control, e.g. `charles.delete.test@gmail.com` (or any email — use one you can remember for 5 minutes)
5. Pick a password you will remember for the video, e.g. `TestDelete123!`
6. Finish sign-up until you are inside the app

---

## PART B — Record the video on your iPhone (5 minutes)

### Turn on Screen Recording (one-time setup)

1. Open iPhone **Settings**
2. Tap **Control Center**
3. Scroll to **Screen Recording** — tap the green **+** if it is not already added

### Record

1. Swipe down from the top-right corner (Control Center)
2. Tap the **Record** button (circle icon). A 3-2-1 countdown starts.
3. Open **GatorVault Insider** and do this slowly:

   - You are signed in as your test account
   - Tap **Menu** (bottom navigation)
   - Tap **Membership & Account**
   - Scroll until you see red **Delete account**
   - Tap **Delete my account**
   - Enter your password
   - Type **DELETE** (all caps) in the confirm box
   - Tap **Permanently delete account**
   - Wait until you see the welcome / signed-out screen

4. Stop recording: tap the red bar at the top of the screen, or open Control Center and tap Record again
5. The video saves to your **Photos** app

Tip: Move slowly. Apple reviewers need to read each screen.

---

## PART C — Upload video + notes in App Store Connect (10 minutes)

1. On a computer, go to https://appstoreconnect.apple.com and sign in
2. Click **Apps** → **GatorVault Insider** (or your app name)
3. Click the **App Store** tab on the left
4. Under **iOS App**, click version **1.0** (or your current version)
5. Scroll down to **App Review Information**
6. In the **Notes** box, paste this:

```
Account deletion path:
Menu → Membership & Account → Delete account
User enters password and types DELETE to confirm.
This permanently deletes the account (not deactivation).

Demo account for your testing (please do NOT delete):
appreview@gatorvaultinsider.com

No gambling in this app.
Paid content is sold through Apple In-App Purchase only.

A screen recording of the deletion flow is attached / uploaded separately.
```

7. If there is an attachment field for notes, attach your screen recording. If not:
   - AirDrop or email the video to your Mac
   - Some teams upload to iCloud and paste a link in Notes — or attach when replying in Resolution Center (Part D)

---

## PART D — Reply to Apple (3 minutes)

1. In App Store Connect, open your app
2. Look for **Resolution Center** or the message thread from App Review (bell icon or Messages)
3. Click **Reply**
4. Paste:

```
Hello,

Account deletion is available inside the app:
Menu → Membership & Account → Delete account

The user enters their password and types DELETE to permanently delete their account.
A screen recording demonstrating sign-in through deletion confirmation is attached in App Review Information / this reply.

Regarding Guideline 2.1:
- The app does not offer betting or gambling.
- Premium content is purchased through Apple In-App Purchase only.

Thank you,
Charles Rourk
```

5. Attach the same screen recording to the reply if App Store Connect lets you attach files there
6. Send

---

## PART E — Submit a new build (if you use Codemagic — no Mac needed)

Code fixes are already on GitHub (main). You need a new iOS build number so Apple sees the update.

1. Go to https://codemagic.io and sign in
2. Open your **GatorVault** app / **gatorvault-api** project
3. Start workflow **iOS Release Build** (or similar name)
4. Wait 15–30 minutes for green checkmark
5. Back in App Store Connect → your app → **TestFlight** — wait until build shows **Ready to Submit** (may take another 15–30 min)
6. Go to **App Store** tab → version 1.0 → **Build** section → click **+** → pick the NEW build (e.g. 1.0 build 9)
7. Click **Add for Review** / **Submit for Review**

If you do NOT use Codemagic and have a Mac with Xcode, ask and we can write Mac-specific steps.

---

## Checklist

- [ ] Created throwaway test account
- [ ] Recorded screen video of full delete flow
- [ ] Pasted notes in App Review Information
- [ ] Replied to Apple in Resolution Center with video attached
- [ ] New build submitted for review (Codemagic or Xcode)

---

## If something goes wrong

| Problem | What to do |
|---------|------------|
| No "Delete account" on Membership page | Update app from TestFlight or submit new Codemagic build first |
| Delete fails with error | Make sure API is deployed (Render); try again in a few minutes |
| Cannot find Resolution Center | App Store Connect → your app → look under App Review or the rejection email link |
| Codemagic build fails | Open build log in Codemagic, copy error, we can fix |

Support email for Apple listing: support@gatorvaultinsider.com
