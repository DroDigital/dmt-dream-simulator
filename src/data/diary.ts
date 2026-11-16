// The Dream Diary: short fragments, written for this game in the manner of a
// dream journal. One is shown at each waking; its keywords seed the next
// night's event deck. Community fragments are added in free updates.

const RAW = `
I was at my grandmother's house but the stairs went on for an hour. Nobody minded.|stairs,house,waiting
A bus came and I knew I had to get on it, but I only waved.|bus,waiting,street
There was a swimming pool in the school gym. The water was warm and full of letters.|school,water,letter
I found a door in my bedroom wall I had never noticed. Behind it was another bedroom, exactly the same.|door,room,same
The moon was very close and made a sound like a fridge.|moon,machine,sound
My teeth were fine. Everyone kept asking.|pointless,people
I was late for an exam in a subject that does not exist.|school,clock,late
A woman sold lanterns that were also small dogs.|lantern,dog,market
I could fly but only about a metre off the ground, and only slowly.|float,slow,air
The sea came up the stairs politely and waited at the door.|water,stairs,door
Everyone at the party was a version of my old teacher.|people,school,party
I lost my shoes and found a better pair inside a fish.|shoe,fish,found
The train had no driver, only a very tidy paper man.|train,paper,conductor
A tree was growing through the kitchen table. We ate around it.|tree,house,dinner
It snowed indoors and it was not cold.|snow,room,indoor
I had a sister I don't have. She was very kind about it.|people,tender,family
There was a telephone in the forest. It rang and rang.|telephone,tree,ring
I walked down a street I know, but all the houses were facing the wrong way.|street,house,wrong
I was trying to read a sign and the letters kept swimming away.|letter,glyph,swim
A whale went past the window of the flat, slowly, like a bus.|whale,window,slow
The supermarket had an aisle that was a beach.|sea,shop,sand
I held a light bulb and it hummed my favourite song.|light,song,hum
A cat told me the time and was wrong.|cat,clock,wrong
I was a child again and also myself, in the same coat.|child,coat,two
The library was underwater and nobody was surprised.|library,water,book
I kept finding coins in my pockets, each from a different country that does not exist.|coin,pocket,country
There was a red kite in the sky and I knew it was mine.|kite,red,sky
A staircase went down into a lake and I followed it.|stairs,water,down
My old phone number rang. I answered and heard rain.|telephone,rain,old
Everything was made of paper and folded when I touched it.|paper,fold,touch
I was at a station and every train went to the same place, which was here.|train,station,here
There were two moons and one of them was shy.|moon,two,shy
A vending machine gave me a warm stone instead of a drink.|machine,stone,warm
I had to carry a lantern through a field without letting it go out.|lantern,field,careful
My house had a new room full of televisions, all showing the sea.|tv,sea,room
I was walking very fast and the street was walking slowly the other way.|street,walk,fast
A man made of static stood very still at the end of the corridor.|watcher,static,corridor
We had a picnic on the roof of a cathedral and the glass was warm.|glass,cathedral,picnic
Fish swam through the air of the classroom. The teacher pretended not to see.|fish,school,air
Someone had left a cake on the stairs, with my name spelled wrong.|cake,stairs,name
I was looking for a word and found it under a stone.|word,stone,found
The sky was full of folded birds.|paper,bird,sky
A bell rang and everyone sat down at once.|bell,people,sit
I was underwater but could breathe, and so could my books.|water,book,breathe
There was a door at the bottom of the swimming pool.|door,water,down
I walked through a house that kept repeating, a little different each time.|house,repeat,different
The clocks in town all disagreed and argued quietly.|clock,town,argue
I met myself coming the other way and we nodded.|self,meet,street
The desert was made of tiny letters and they spelled my footsteps.|desert,glyph,footsteps
A lantern woman stood at the window. I did not want to see her face.|lantern,woman,window
The night was very long and that was fine.|night,long,calm
I was given a ticket for a train that only runs on Thursdays in the sky.|ticket,train,sky
The sea was made of light and very loud.|sea,light,loud
My hands were full of moths that did not want to leave.|moth,hands,tender
I was in a market at night and every stall sold the same lamp.|market,lamp,same
There was a hole in the garden that went all the way through to the stars.|hole,stars,garden
I was very small and the grass was a forest.|small,grass,forest
I was very tall and the town was a carpet.|tall,town,carpet
Someone was playing a piano in the next room, every room.|piano,room,music
We could not find the way out of the school, so we stayed and it was nice.|school,stay,together
A boat came down the road and offered me a lift.|boat,road,offer
The coral was breathing and I breathed with it.|coral,breathe,sea
There was a pipe organ that was also alive.|organ,flesh,music
The fruit on the trees were tiny planets and one had weather.|planet,tree,weather
I found a jar full of a summer evening.|jar,summer,evening
My reflection waved first.|mirror,reflection,wave
I could not remember my house so I lived in a bus shelter.|bus,shelter,home
The rain fell upwards and gathered in the clouds like fish.|rain,up,fish
A white staircase went all the way down to the sea. I sat on it.|stairs,sea,white
There was static in the meadow, like snow made of sound.|static,meadow,sound
I had a meeting with the moon. It was cancelled.|moon,meeting,cancelled
The streetlights turned their heads to watch me go by.|lamp,watched,street
I was carrying a sleeping lantern and trying not to wake it.|lantern,sleep,careful
The whole city was folding itself away for the night.|city,paper,fold
I was in a cathedral made of soap bubbles.|cathedral,bubble,glass
A friend I have never met was waiting at the end of the platform.|friend,platform,waiting
All the books had my handwriting in them.|book,handwriting,library
The night school had a class on how to sleep.|school,sleep,class
My grandmother was a tree and she was happy.|tree,family,tender
I swam through a reef that kept making more of itself.|coral,fractal,swim
There was a hum in the walls, warm, like a large animal asleep.|wall,hum,flesh
Everything I touched took me somewhere else.|touch,link,elsewhere
A door opened onto the inside of a television.|door,tv,inside
I was walking in a field of old TVs and each one showed my room.|tv,field,room
The moths sang a single long note.|moth,song,note
I was at the beach at midnight and the sand was warm letters.|beach,glyph,warm
I was taller than the lighthouse and very gentle with it.|tall,lighthouse,gentle
There was an extra day in the week. Nobody used it.|day,extra,pointless
A crowd of paper people clapped for no reason.|paper,people,clap
I found my childhood bicycle leaning against a cloud.|bicycle,cloud,child
The kitchen was full of water and the fish were cooking.|fish,kitchen,water
I kept trying to phone home but the numbers moved.|telephone,number,home
I followed a light into a smaller light into a smaller light.|light,follow,small
The road ended in a staircase, the staircase ended in the sky.|road,stairs,sky
We were all holding hands and floating.|together,hands,float
Somebody had painted the whole sea pink.|sea,pink,paint
There was a quiet place behind the bookshelf where I could hear the sea.|quiet,book,sea
My shadow went home before me.|shadow,home,leave
The train's windows showed other places, one per window.|train,window,places
I was given a lantern and told it was a memory.|lantern,memory,gift
The street was the same street over and over and I liked it.|street,repeat,calm
The town was being slowly erased from the edges.|town,erase,edge
A tall man walked past without turning. The music went thin.|watcher,music,thin
I found a room full of every light I have ever switched off.|light,room,memory
I heard a song coming out of a drain.|song,drain,water
The cathedral rang with colours instead of bells.|cathedral,colour,bell
My bed was in the middle of the sea and it was fine.|bed,sea,fine
I stood still for a long time and the world came closer to look.|still,world,look
The vending machines were having a meeting.|machine,meeting,funny
I could see the inside of the moon, it was a waiting room.|moon,waiting,room
I was late for something important, but it waited for me.|late,waiting,kind
A paper crane flew into my mouth and became a word.|paper,crane,word
Everything was very far away and also right here.|far,here,both
I woke up inside the dream and went back to sleep inside it.|sleep,nested,dream
`;

export interface DiaryFragment { text: string; keywords: string[] }

export const DIARY: DiaryFragment[] = RAW.trim().split('\n').map((line) => {
  const [text, kw] = line.split('|');
  return { text: text.trim(), keywords: (kw ?? '').split(',').map((s) => s.trim()).filter(Boolean) };
});
