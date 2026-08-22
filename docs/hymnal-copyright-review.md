# Hymnal import — copyright review

The FBC hymnal (`0013_fbc_hymnal.sql`) imports 399 hymns into the shared
song library. Because an encoder publishes to **every church on the platform**,
the platform is the one distributing the words — a different position from a
single church reproducing them under its own CCLI licence.

This is a best-effort classification, not legal advice. Please review it.

> The **#** column below is the hymn's number in `hymns.json`, so you can find it
> in the source file. It is not stored anywhere in the app or database.

## Imported without lyrics (21)

Marked `copyright_status = 'metadata_only'`. Title and category are present so
churches can find the hymn and add the words themselves.

| # | Title | Why |
|---|-------|-----|
| 12 | How Great Thou Art | Stuart K. Hine's English text, 1949 |
| 56 | In Times Like These | Ruth Caye Jones, 1944 |
| 82 | Because He Lives | Gloria & William J. Gaither, 1971 |
| 90 | Victory in Jesus | E. M. Bartlett, 1939 |
| 93 | Burdens Are Lifted at Calvary | John M. Moore, 1952 |
| 100 | When He Reached Down His Hand for Me | G. E. Wright, 1950s |
| 104 | He Touched Me | William J. Gaither, 1963 |
| 110 | Heaven Came Down | John W. Peterson, 1961 |
| 120 | Then Jesus Came | Homer Rodeheaver / Oswald J. Smith, 1940 |
| 146 | Surely Goodness and Mercy | John W. Peterson & Alfred B. Smith, 1958 |
| 147 | No One Ever Cared for Me Like Jesus | Charles F. Weigle, 1932 |
| 186 | I'd Rather Have Jesus | George Beverly Shea's tune, 1939 |
| 220 | So Send I You | Margaret Clarkson, 1954 |
| 252 | It's Not an Easy Road | Ira F. Stanphill, 1952 |
| 306 | A Mansion Over the Hilltop | Ira F. Stanphill, 1949 |
| 333 | When We See Christ | Esther Kerr Rusthoi, 1941 |
| 357 | Now I Belong to Jesus | Norman J. Clayton, 1943 |
| 364 | It Took a Miracle | John W. Peterson, 1948 |
| 370 | I Have Decided to Follow Jesus | Common arrangement, 1959 |
| 372 | He Will Hold Me Fast | Matt Merker's refrain and tune, 2013 |
| 380 | Cleanse Me | J. Edwin Orr, 1936 |

## Imported WITH lyrics, but worth checking (51)

These are mostly 20th-century gospel and chorus-book material that I could not
date confidently. They came in with full lyrics. If any turn out to be under
copyright, open the song in `/encoder`, set **Copyright** to *No lyrics — still
under copyright*, and clear its sections.

| # | Title | Category |
|---|-------|----------|
| 4 | Great Is Our God | Praise and Worship |
| 8 | Thou Our Father | Praise and Worship |
| 11 | How Great Is Your Name | Praise and Worship |
| 16 | All The Earth | Praise and Worship |
| 20 | Praise Be To God | Praise and Worship |
| 22 | How Excellent | Praise and Worship |
| 24 | The Way, The Truth, The Life | Gospel Songs |
| 73 | Running Over | Praise and Worship |
| 79 | I Lost the World | Salvation |
| 85 | God Forgives and Forgets | Hymns |
| 87 | That Man of Calvary | Jesus Christ |
| 117 | All Is Well | Comfort and Hope |
| 119 | Try Jesus | Invitation |
| 129 | He'll Never Forget to Keep Me | Assurance |
| 130 | In the Hollow of His Hand | Guidance and Providence |
| 140 | I Will Guide Thee | Guidance and Providence |
| 144 | God Can Do Anything But Fail | Faith and Trust |
| 157 | All Things Are Possible | Faith and Trust |
| 159 | In the Old-Time Way | Christian Life and Discipleship |
| 180 | I Am Determined to Hold Out | Christian Life and Discipleship |
| 195 | Christ Hath Redeemed | Salvation |
| 196 | Of Gifts and Powers | Holy Spirit |
| 197 | With Signs Following | Holy Spirit |
| 198 | Bring Your Vessels Not a Few | Holy Spirit |
| 201 | Give Me a Double Portion | Holy Spirit |
| 204 | Waiting on the Lord | Holy Spirit |
| 216 | Call for Workers | Missions and Evangelism |
| 224 | Sound the Alarm, Watchman | Invitation |
| 225 | God Gives His People Strength | Hymns |
| 235 | Grant to Us, O Lord, a Heart Renewed | Grace and Mercy |
| 237 | When I Prayed Through | Hymns |
| 240 | Christian Home | Hymns |
| 242 | Victory Ahead | Faith and Trust |
| 249 | Victory All the Time | Christian Life and Discipleship |
| 250 | When the Battle's Over | Christian Life and Discipleship |
| 251 | The God to Whom I Pray | Faith and Trust |
| 257 | Tomorrow May Mean Goodbye | Death and Resurrection |
| 259 | In the Morning of Joy | Second Coming |
| 262 | I Shall Be No Stranger There | Heaven and Eternity |
| 264 | When I Get Home | Heaven and Eternity |
| 269 | Beulah Land | Heaven and Eternity |
| 270 | I Have Heard of a Land | Heaven and Eternity |
| 275 | Come Over | Heaven and Eternity |
| 276 | I'll Live On | Heaven and Eternity |
| 279 | You Never Mentioned Him to Me | Missions and Evangelism |
| 285 | Sorry, I Never Knew You | Warning |
| 286 | God Help You to Follow His Banner | Guidance and Providence |
| 290 | Father God in Heaven | Prayer |
| 300 | We Stand for God | Hymns |
| 367 | Isn't the Love of Jesus Something Wonderful | Love and Devotion |
| 398 | All I Need | Jesus Christ |

## Everything else

The remaining 327 hymns are 19th- or early-20th-century works published
before 1930, and are public domain in the US.
