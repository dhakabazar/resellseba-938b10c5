# নতুন “নগরী” storefront theme

## লক্ষ্য
HT Bazar-এর সহজ shopping flow ও product-first presentation থেকে ধারণা নিয়ে, কিন্তু layout ও visual design হুবহু কপি না করে, **নগরী** নামে সম্পূর্ণ নতুন sidebar-free storefront theme তৈরি হবে। বর্তমান সব theme ও data অক্ষত থাকবে।

## ডিজাইন
- পরিষ্কার announcement strip, compact logo/search/cart header এবং আলাদা mobile menu sheet। কোনো sidebar থাকবে না।
- প্রথম screen-এ বড় image banner, পরিষ্কার offer copy এবং সরাসরি Shop now action।
- icon-led service highlights, image category carousel, sale/best-seller bands এবং দ্রুত scan করা যায় এমন product grid।
- product card হবে Poripati ও সহজ শপ থেকে আলাদা: landscape-oriented image area, discount/stock treatment, prominent price এবং quick order action।
- palette হবে balanced marketplace style; চারটি সম্পূর্ণ palette থাকবে এবং reseller নিজের পছন্দ বেছে নিতে পারবেন।

## সব storefront page
- **Home:** banner, benefits, category carousel, featured/new products, reviews, FAQ ও footer।
- **Shop / category:** sidebar ছাড়া title, result count, sort control ও clean product grid।
- **Product:** image gallery, product information, quantity, add-to-cart/order, delivery/return details ও related products।
- **Checkout:** compact customer form, payment selection ও sticky order summary; mobile order button সহজে পৌঁছানো যাবে।
- **Success:** order number ও payment result সহ theme-matched confirmation screen।

## Theme settings
- Theme picker-এ “নগরী” card ও চার palette যোগ হবে।
- Banner image/text, section titles, benefits, offer labels, reviews, FAQ, product trust copy, checkout text ও footer reseller panel থেকে editable থাকবে।
- Store logo থাকলে শুধু logo দেখাবে; না থাকলে store name fallback হবে।

## Load speed ও isolation
- নগরীর visual code আলাদা module-এ থাকবে এবং `React.lazy` দিয়ে শুধু theme active হলে load হবে।
- Home, listing, product, checkout ও success-এর আলাদা boundaries থাকবে; inactive theme-এর visual module browser-এ request হবে না।
- Store bootstrap একবারই হবে; tracking, cart, payment, delivery ও order logic global/shared থাকবে।

## যাচাই
- Desktop ও mobile-এ home, search, menu, category carousel, shop, category, product, cart, checkout ও success page যাচাই হবে।
- কোনো overlap, horizontal overflow বা visible scrollbar থাকবে না।
- Type check, browser console এবং network chunks দেখে active-theme isolation নিশ্চিত করা হবে।
