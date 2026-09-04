const PLAN_DATA = [
      // ---- WEEK 1 ----
      {
        day:1, date:'Sep 3', dow:'Thu', type:'weekday', weekNum:1,
        morning:[
          {cat:'Admin',time:'45min',text:'Fully optimize your Google Business Profile: add every service with pricing, write a keyword-rich business description, confirm hours are 8AM–6PM'},
          {cat:'Admin',time:'30min',text:'Upload 5+ photos to Google Business Profile (van exterior, equipment, logo)'},
          {cat:'Marketing',time:'30min',text:'Audit your Facebook page — make sure all contact info, hours, and booking link (primeshinefl.com/booking) are correct'}
        ],
        evening:[
          {cat:'Social Media',time:'30min',text:'Design 3 post templates in Canva (free): Before/After template, "NOW BOOKING" template, Special Offer template'},
          {cat:'Admin',time:'15min',text:'Write down your 3 service packages with exact prices and what\'s included — know your menu cold'}
        ],
        weekend:[],
        tip:'Your Google Business Profile is your #1 free marketing tool. Fully filled profiles get 5x more clicks. Do this FIRST before anything else.',
        quote:'"The secret of getting ahead is getting started." — Mark Twain'
      },
      {
        day:2, date:'Sep 4', dow:'Fri', type:'weekday', weekNum:1,
        morning:[
          {cat:'Marketing',time:'1hr',text:'Create a flyer that matches the LIVE website — not a new discount. Headline: "First 10 customers: 50% off any package." Prices: Exterior $40/$50 · Interior $60/$80 · Full $120/$150. Print 50–100 copies at Walmart or Office Depot (~$10–15). Do not print 20% off.'},
          {cat:'Admin',time:'30min',text:'Set up your Meta ad: Go to Meta Business Suite → Boost a post OR create an ad targeting Lakeland/Bartow/Winter Haven, 10-mile radius, age 25–55, $5/day, goal = "Get More Messages"'}
        ],
        evening:[
          {cat:'Social Media',time:'20min',text:'Post the 50% first-10 offer on Facebook and Instagram. Use the same prices as primeshinefl.com. Do not invent a 20% deal.'},
          {cat:'Outreach',time:'20min',text:'Share the post to 3 local Facebook community groups (search "Lakeland FL", "Bartow Neighbors", "Winter Haven Community")'}
        ],
        weekend:[],
        tip:'Your Meta ad targeting should focus on homeowners aged 30–55 within 10 miles. These are your most likely customers — they own cars and value convenience.',
        quote:'"Don\'t wait for opportunity. Create it." — George Bernard Shaw'
      },
      {
        day:3, date:'Sep 5', dow:'Sat', type:'weekend', weekNum:1,
        morning:[], evening:[],
        weekend:[
          {cat:'Social Media',time:'15min',text:'Share your Facebook post to 2 more local Facebook groups'},
          {cat:'Outreach',time:'15min',text:'Send a personal text to 5 close friends/family: "Hey! I officially launched PrimeShine Mobile Detailing. I come to YOU — interior, exterior, full detail. Know anyone who needs their car cleaned? I\'ll hook them up! primeshinefl.com/booking"'}
        ],
        tip:'Personal texts convert WAY better than social posts. People book from people they trust.',
        quote:'"Your network is your net worth." — Porter Gale'
      },
      {
        day:4, date:'Sep 6', dow:'Sun', type:'rest', weekNum:1,
        morning:[], evening:[],
        weekend:[
          {cat:'Optional',time:'10min',text:'Check Facebook messages/DMs for any inquiries. Reply with your booking link.'}
        ],
        tip:'Rest is part of the business plan. A burnt-out owner = cancelled jobs. Recharge today.',
        quote:'"Almost everything will work again if you unplug it for a few minutes, including you." — Anne Lamott'
      },
      {
        day:5, date:'Sep 7', dow:'Mon', type:'weekday', weekNum:1,
        morning:[
          {cat:'Outreach',time:'2hrs',text:'Drive through 2 neighborhoods in Lakeland and distribute 50 flyers — put them on mailboxes, doors, or under windshield wipers in parking lots (grocery stores, churches, apartment complexes)'},
          {cat:'Marketing',time:'30min',text:'Identify 5 local car dealerships and get their contact info'}
        ],
        evening:[
          {cat:'Outreach',time:'30min',text:'Follow up on any Facebook messages or ad leads from the weekend. Reply fast — speed to respond = more bookings'},
          {cat:'Admin',time:'15min',text:'Create a simple Google Sheet or notes doc to track: Name, Service, Date, Price for every job'}
        ],
        weekend:[],
        tip:'Apartment complexes are goldmines. Residents can\'t drive to a car wash easily. Ask the office manager if you can leave flyers in the lobby.',
        quote:'"Success usually comes to those who are too busy to be looking for it." — Henry David Thoreau'
      },
      {
        day:6, date:'Sep 8', dow:'Tue', type:'weekday', weekNum:1,
        morning:[
          {cat:'Social Media',time:'1hr',text:'Take 10+ high-quality photos: your van exterior, supplies organized, close-up of cleaning tools, "ready for work" shot. These become your content for weeks.'},
          {cat:'Outreach',time:'1hr',text:'Call or walk into 3 local car dealerships. Offer: "I can detail trade-ins or customer vehicles on-site. I come to you — no drop-off needed." Leave a flyer and your card.'}
        ],
        evening:[
          {cat:'Marketing',time:'30min',text:'Create a "Refer a Friend" graphic: "Refer a friend who books = YOU get $10 off your next detail!" Post this on Facebook.'},
          {cat:'Social Media',time:'20min',text:'Post one of your van/equipment photos with caption: "Fully equipped and ready to come to YOU. Book at primeshinefl.com/booking 📞 863-860-9238"'}
        ],
        weekend:[],
        tip:'Dealerships can be a huge recurring revenue stream. Even 2–3 trade-in details per month adds $300–600 in consistent income.',
        quote:'"The best marketing doesn\'t feel like marketing." — Tom Fishburne'
      },
      {
        day:7, date:'Sep 9', dow:'Wed', type:'weekday', weekNum:1,
        morning:[
          {cat:'Admin',time:'30min',text:'Check your Meta ad performance — how many impressions, clicks, replies? If less than 500 impressions, widen your audience radius to 15 miles'},
          {cat:'Outreach',time:'1.5hrs',text:'Contact 5 local real estate agents on Facebook or by phone. Pitch: "I can detail a client\'s car before a showing or closing — makes a great impression. I come to them." Offer a real estate agent referral rate.'},
          {cat:'Revenue',time:'30min',text:'Owner upsell only (not on the website yet): offer a monthly wash at $55 if someone asks for a repeat. Do not change website prices. Quote the live menu: Exterior $40/$50 · Interior $60/$80 · Full $120/$150.'}
        ],
        evening:[
          {cat:'Social Media',time:'20min',text:'Post a "did you know?" educational post: "Did you know regular detailing protects your car\'s paint and resale value? Book PrimeShine — we come to you! primeshinefl.com/booking"'}
        ],
        weekend:[],
        tip:'Real estate agents make great referral partners. They need cars looking clean for client meetings. One agent can send you 2–4 jobs per month.',
        quote:'"Opportunities don\'t happen. You create them." — Chris Grosser'
      },
      // ---- WEEK 2 ----
      {
        day:8, date:'Sep 10', dow:'Thu', type:'weekday', weekNum:2,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Complete your first paying detail job! If not yet booked: reach out to a neighbor, coworker, or family friend and offer a discounted or free detail in exchange for a Google review + before/after photos'}
        ],
        evening:[
          {cat:'Social Media',time:'30min',text:'Post the before/after photos from today\'s job. Caption: "Another satisfied customer! ✨ Book your detail at primeshinefl.com/booking or call 863-860-9238"'},
          {cat:'Outreach',time:'15min',text:'Text the client after: "Hey [Name], thanks so much for booking PrimeShine! If you have 2 minutes, a Google review would mean the world to me: [your Google review link]"'}
        ],
        weekend:[],
        tip:'Your first Google review is the hardest to get. Do whatever it takes to get it — even a discounted job. Reviews are worth $500+ in future business.',
        quote:'"A journey of a thousand miles begins with a single step." — Lao Tzu'
      },
      {
        day:9, date:'Sep 11', dow:'Fri', type:'weekday', weekNum:2,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job #2 if booked. If not: canvass a new neighborhood with remaining flyers'}
        ],
        evening:[
          {cat:'Outreach',time:'30min',text:'Text 10 people from your contacts: "Hey! Quick favor — if you know anyone who needs their car detailed, I\'d love the referral. I\'m PrimeShine Mobile Detailing — I come to you anywhere in Lakeland, Bartow, or Winter Haven."'},
          {cat:'Social Media',time:'15min',text:'Check and respond to all Facebook comments and messages'}
        ],
        weekend:[],
        tip:'Referral texts to your personal contacts close at a much higher rate than cold ads. Don\'t skip this step.',
        quote:'"If people like you, they\'ll listen to you. If they trust you, they\'ll do business with you." — Zig Ziglar'
      },
      {
        day:10, date:'Sep 12', dow:'Sat', type:'weekend', weekNum:2,
        morning:[], evening:[],
        weekend:[
          {cat:'Social Media',time:'20min',text:'Post: "Limited spots this week. Interior $60 sedan / $80 SUV. We come to you. Book: primeshinefl.com/booking" — same prices as the website.'}
        ],
        tip:'Urgency drives action. "Limited spots" posts consistently outperform generic posts for service businesses.',
        quote:'"Action is the foundational key to all success." — Pablo Picasso'
      },
      {
        day:11, date:'Sep 13', dow:'Sun', type:'rest', weekNum:2,
        morning:[], evening:[],
        weekend:[
          {cat:'Optional',time:'10min',text:'Check DMs and reply to any booking inquiries.'}
        ],
        tip:'Set a Facebook auto-reply so leads don\'t go cold while you\'re watching the game.',
        quote:'"Take rest; a field that has rested gives a bountiful crop." — Ovid'
      },
      {
        day:12, date:'Sep 14', dow:'Mon', type:'weekday', weekNum:2,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s) if booked. Aim for 2 jobs today if possible — one in morning, one at a location near pickup time'}
        ],
        evening:[
          {cat:'Marketing',time:'30min',text:'Design a "Loyalty Card" concept: "Book 5 details, get your 6th interior FREE." Even a digital image to send via text works.'},
          {cat:'Revenue',time:'30min',text:'Text every client you\'ve had so far: "Thanks again for choosing PrimeShine! As a valued customer, here\'s our loyalty program..." — attach the loyalty card image.'}
        ],
        weekend:[],
        tip:'Loyalty programs dramatically increase rebooking rates. A customer who books 5 times is worth $400–900+ in lifetime value.',
        quote:'"Your most unhappy customers are your greatest source of learning." — Bill Gates'
      },
      {
        day:13, date:'Sep 15', dow:'Tue', type:'weekday', weekNum:2,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Detail job(s)'}
        ],
        evening:[
          {cat:'Social Media',time:'30min',text:'Engage on Facebook — respond to ALL comments on your posts, like and reply to reviews. The algorithm rewards engagement.'},
          {cat:'Admin',time:'20min',text:'Review your tracking sheet — how many jobs booked? Total revenue this week? Are you on track?'}
        ],
        weekend:[],
        tip:'Responding to Google reviews (good and bad) shows professionalism and boosts your local SEO ranking.',
        quote:'"Quality is not an act, it is a habit." — Aristotle'
      },
      {
        day:14, date:'Sep 16', dow:'Wed', type:'weekday', weekNum:2,
        morning:[
          {cat:'Outreach',time:'1hr',text:'Join 3 more Facebook groups: look for "Polk County", "Central Florida", neighborhood-specific groups. Introduce yourself: "Hey everyone! I run PrimeShine Mobile Detailing — I bring professional car detailing RIGHT to your driveway in Lakeland, Bartow, and Winter Haven. No drop-off needed. DM me or visit primeshinefl.com/booking!"'},
          {cat:'Detailing',time:'Remaining',text:'Job(s) if booked'}
        ],
        evening:[
          {cat:'Admin',time:'30min',text:'Week 2 Review: Total revenue so far? Jobs completed? Reviews earned? Meta ad spending performing? Adjust ad if needed.'}
        ],
        weekend:[],
        tip:'By end of Week 2, you should have at least 2–4 completed jobs and 2+ Google reviews. If not, double down on personal outreach — it\'s the fastest path to bookings.',
        quote:'"The only way to do great work is to love what you do." — Steve Jobs'
      },
      // ---- WEEK 3 ----
      {
        day:15, date:'Sep 17', dow:'Thu', type:'weekday', weekNum:3,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Revenue',time:'30min',text:'Text every client from Week 1–2: "Hey! PrimeShine has a Monthly Maintenance Package — 1 full exterior wash every 4 weeks for just $55/month (you save $$$). Want me to set you up?" Recurring clients = predictable income.'}
        ],
        weekend:[],
        tip:'Even 3 monthly maintenance clients = $165/month of guaranteed income before you book a single new customer.',
        quote:'"Revenue is vanity, profit is sanity, but cash is king." — Alan Miltz'
      },
      {
        day:16, date:'Sep 18', dow:'Fri', type:'weekday', weekNum:3,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Social Media',time:'45min',text:'Create a short video reel (even 30–60 seconds on your phone): show your van, your supplies, a quick clip of cleaning/buffing, end with your logo. Post to Facebook and Instagram Reels. Caption: "We come to YOU. 📍 Lakeland | Bartow | Winter Haven. Book at primeshinefl.com/booking"'}
        ],
        weekend:[],
        tip:'Video content gets 3–5x more organic reach than static images on Facebook. Even a shaky phone video is better than nothing.',
        quote:'"Content is fire; social media is gasoline." — Jay Baer'
      },
      {
        day:17, date:'Sep 19', dow:'Sat', type:'weekend', weekNum:3,
        morning:[], evening:[],
        weekend:[
          {cat:'Social Media',time:'20min',text:'Screenshot any 5-star Google reviews you\'ve received. Post them on Facebook with: "Our customers love us! ⭐⭐⭐⭐⭐ Don\'t miss out — book your detail today: primeshinefl.com/booking"'}
        ],
        tip:'Social proof (reviews) is your best marketing content. Post every single review you get.',
        quote:'"People influence people. Nothing influences people more than a recommendation from a trusted friend." — Mark Zuckerberg'
      },
      {
        day:18, date:'Sep 20', dow:'Sun', type:'rest', weekNum:3,
        morning:[], evening:[],
        weekend:[
          {cat:'Optional',time:'5min',text:'Check DMs only if you get a notification.'}
        ],
        tip:'A well-rested owner provides better service. Quality > quantity on every job.',
        quote:'"Rest when you\'re weary. Refresh and renew yourself, your body, your mind, your spirit." — Ralph Marston'
      },
      {
        day:19, date:'Sep 22', dow:'Mon', type:'weekday', weekNum:3,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Outreach',time:'30min',text:'Contact 5 local real estate agents via Facebook messenger. Search "real estate Lakeland FL" and message them your pitch: "Hi [Name]! I run PrimeShine Mobile Detailing and specialize in making cars look great before closings or client meetings. I come right to your location. Would love to be your go-to detailer!"'}
        ],
        weekend:[],
        tip:'One real estate agent partnership could generate 1–2 referrals per month consistently for years.',
        quote:'"Networking is not about just connecting people. It\'s about connecting people with people, people with ideas, and people with opportunities." — Michele Jennae'
      },
      {
        day:20, date:'Sep 23', dow:'Tue', type:'weekday', weekNum:3,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Marketing',time:'30min',text:'Create a "Fall Special" promotion for October: "Fall Refresh Special — Full detail + FREE tire shine. Book in October and save $20." Design in Canva.'},
          {cat:'Social Media',time:'15min',text:'Tease the upcoming Fall Special on Facebook: "Something special coming in October... 👀 Stay tuned!"'}
        ],
        weekend:[],
        tip:'Seasonal promotions create urgency and give customers a reason to book NOW rather than "later."',
        quote:'"In the middle of difficulty lies opportunity." — Albert Einstein'
      },
      {
        day:21, date:'Sep 24', dow:'Wed', type:'weekday', weekNum:3,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Admin',time:'45min',text:'Week 3 Mid-Program Review: Total revenue? Jobs completed? Google reviews? Facebook followers/page likes growth? Meta ad ROI? Write it all down. What\'s working? Do MORE of that.'}
        ],
        weekend:[],
        tip:'By Day 21, you should have 8–12 completed jobs. If revenue is behind, shift to more direct outreach and less passive social posting.',
        quote:'"What gets measured gets managed." — Peter Drucker'
      },
      // ---- WEEK 4 ----
      {
        day:22, date:'Sep 25', dow:'Thu', type:'weekday', weekNum:4,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Revenue',time:'30min',text:'Text every client you\'ve served: "Hey [Name]! It\'s Charles from PrimeShine. Hope your car is still looking great! I\'m setting up my October schedule now — want me to get you on the calendar for a monthly maintenance or full detail?" — Personalized texts = highest rebooking rate.'}
        ],
        weekend:[],
        tip:'It costs 5x more to acquire a new customer than to retain an existing one. Chase rebookings aggressively.',
        quote:'"The goal is to turn data into information, and information into insight." — Carly Fiorina'
      },
      {
        day:23, date:'Sep 26', dow:'Fri', type:'weekday', weekNum:4,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Marketing',time:'20min',text:'Go to Meta Business Suite → find your best-performing post (most reach/engagement) → Boost it with an extra $5–10 for 3 days. This amplifies what\'s already working.'},
          {cat:'Social Media',time:'15min',text:'Post a "thank you" post: "To everyone who has booked with PrimeShine so far — THANK YOU! We\'re just getting started. 🙏 More spots available this week: primeshinefl.com/booking"'}
        ],
        weekend:[],
        tip:'Boosting an already-performing post costs less and converts better than creating a brand new ad from scratch.',
        quote:'"Gratitude is the healthiest of all human emotions." — Zig Ziglar'
      },
      {
        day:24, date:'Sep 27', dow:'Sat', type:'weekend', weekNum:4,
        morning:[], evening:[],
        weekend:[
          {cat:'Social Media',time:'15min',text:'Post your weekend availability: "Got a few spots open this weekend! Who wants their car detailed before the week starts? DM me or book at primeshinefl.com/booking 📞 863-860-9238"'}
        ],
        tip:'Weekend posts for weekend availability can land same-day bookings from people who see the post and act impulsively.',
        quote:'"The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb'
      },
      {
        day:25, date:'Sep 28', dow:'Sun', type:'rest', weekNum:4,
        morning:[], evening:[],
        weekend:[],
        tip:'Celebrate your progress today. Even if you\'re not where you want to be yet, you\'re building something real.',
        quote:'"Success is the sum of small efforts, repeated day in and day out." — Robert Collier'
      },
      {
        day:26, date:'Sep 29', dow:'Mon', type:'weekday', weekNum:4,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Marketing',time:'45min',text:'Build your October Content Calendar: Write out 10–12 post ideas for next month (Fall Special announcement, before/after photos, review highlights, educational tips, "book now" posts, holiday car care tips, etc.)'}
        ],
        weekend:[],
        tip:'A pre-planned content calendar means you never stare at a blank screen wondering what to post. Consistency builds trust.',
        quote:'"Consistency is the true foundation of trust." — Roy T. Bennett'
      },
      {
        day:27, date:'Sep 30', dow:'Tue', type:'weekday', weekNum:4,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Revenue',time:'30min',text:'Rebooking blitz: Text EVERY client from the past 30 days. Offer a returning customer discount: "Book again in October and get $10 off. I want to keep your car looking great!"'},
          {cat:'Outreach',time:'15min',text:'Ask your top 3 happiest clients to leave a Google review if they haven\'t already.'}
        ],
        weekend:[],
        tip:'The goal by end of Month 1 is to have at least 3–5 clients who plan to rebook regularly. That base of recurring customers is the foundation of a sustainable business.',
        quote:'"Customer retention is the new acquisition." — Unknown'
      },
      // ---- WEEK 4+ (Days 28-30) ----
      {
        day:28, date:'Oct 1', dow:'Wed', type:'weekday', weekNum:5,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Admin',time:'30min',text:'Research the Google Business Ads credit offer shown on your Google profile: "Spend $500 get $500 credit." This is for Month 2 when you have more revenue to reinvest.'},
          {cat:'Marketing',time:'20min',text:'Launch your "Fall Refresh Special" promo — post the October graphic on Facebook, Instagram, and share to local groups'}
        ],
        weekend:[],
        tip:'Once you\'re generating consistent revenue, reinvesting even 10–15% into paid ads (Google + Meta) can 3–5x your bookings.',
        quote:'"An investment in knowledge pays the best interest." — Benjamin Franklin'
      },
      {
        day:29, date:'Oct 2', dow:'Thu', type:'weekday', weekNum:5,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Job(s)'}
        ],
        evening:[
          {cat:'Outreach',time:'20min',text:'Send appreciation messages to anyone who referred you a customer: "Hey [Name]! I really appreciate you sending [Client] my way. As a thank-you, your next detail is $10 off. I value your support!"'},
          {cat:'Social Media',time:'15min',text:'Post a "Month 2 coming" teaser: "Month 1 is almost done and we\'re just warming up. October is going to be BIG. Stay tuned 🚀"'}
        ],
        weekend:[],
        tip:'People who refer others are your best marketing asset. Make them feel valued and they\'ll keep sending business.',
        quote:'"Alone we can do so little; together we can do so much." — Helen Keller'
      },
      {
        day:30, date:'Oct 3', dow:'Fri', type:'weekday', weekNum:5, isFinal:true,
        morning:[
          {cat:'Detailing',time:'4hrs',text:'Final job of the 30-day program! Make it count. 🏆'}
        ],
        evening:[
          {cat:'Admin',time:'1hr',text:'30-Day Final Review: Total revenue earned, total jobs completed, Google reviews earned, Facebook page growth, recurring clients secured, what worked best, what to do more of in Month 2'},
          {cat:'Marketing',time:'30min',text:'Post your 30-day milestone on Facebook: "Day 30 of PrimeShine Mobile Detailing ✅ Grateful for every customer who trusted us. Just getting started. Book your spot for October: primeshinefl.com/booking"'}
        ],
        weekend:[],
        tip:'Share your wins publicly. Celebrating milestones on social media builds credibility and shows momentum — both attract more customers.',
        quote:'"The only limit to our realization of tomorrow is our doubts of today." — Franklin D. Roosevelt'
      }
    ];

const WEEK_THEMES = {
      1: {title:'Week 1 — "Build the Foundation"', desc:'Sep 3–9 • Set up your profiles, launch your ad, and start spreading the word.', icon:'🏗️'},
      2: {title:'Week 2 — "Land First Clients & Stack Reviews"', desc:'Sep 10–16 • Get those first jobs, earn Google reviews, and build social proof.', icon:'🤝'},
      3: {title:'Week 3 — "Build Momentum & Recurring Revenue"', desc:'Sep 17–24 • Scale up, create recurring packages, and lock in repeat clients.', icon:'🚀'},
      4: {title:'Week 4 — "Scale & Lock In Recurring Income"', desc:'Sep 25–28 • Maximize bookings, boost best ads, plan for Month 2.', icon:'📈'},
      5: {title:'Week 4+ — "Finish Strong"', desc:'Sep 29–Oct 3 • Final push, rebooking blitz, and celebrate your milestone!', icon:'🏆'}
    };

const CAT_ICONS = {
      'Detailing':'🔧','Marketing':'📣','Outreach':'💬','Social Media':'📱','Admin':'⚙️','Revenue':'💰','Optional':'💤'
    };

const CAT_CLASSES = {
      'Detailing':'cat-detailing','Marketing':'cat-marketing','Outreach':'cat-outreach','Social Media':'cat-social','Admin':'cat-admin','Revenue':'cat-revenue','Optional':'cat-optional'
    };

const PLAN_START_ISO = '2026-09-03';

const REVENUE_GOAL = 3000;

const STORAGE_KEY = 'primeshine_30day_v2';
