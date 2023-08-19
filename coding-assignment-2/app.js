const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        app.listen(3000, () => {
            console.log("DataBase Connected");
        })
    }
    catch (e) {
        console.log(`DB Error ${e.message}`);
        process.exit(1);
    }
};

initializeDbServer();

const authenticateToken = (request, response, next) => {
    const { tweet } = request.body;
    const { tweetId } = request.params;
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader !== undefined) {
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401);
        response.send("Invalid JWT Token");
    }
    else {
        jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
            if(error) {
                response.status(401);
                response.send("Invalid JWT Token")
            }
            else {
                console.log(payload);
                request.payload = payload;
                request.tweetId = tweetId;
                request.tweet = tweet;
                next();
            }
        });
    }
};


//API 1(Register)
app.post("/register", async (request, response) => {
    const { username, password, name, gender} = request.body;
    const getUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';
    `;
    const user = await db.get(getUserQuery);
    if(user === undefined) {
        const passLength = password.length;
        if(passLength < 6) {
            response.status(400);
            response.send("Password is too short");
        }
        else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const createUserQuery = `
            INSERT INTO 
                user ( name, username, password, gender)
            VALUES(
                '${name}',
                '${username}',
                '${hashedPassword}',
                '${gender}'
            )    
            ;`;
            await db.run(createUserQuery);
            response.send("User created successfully");
        }
    }
    else {
        response.status(400);
        response.send("User already exists");
    }
});

//API 2(Login)
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const getUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';
    `;
    const user = await db.get(getUserQuery);
    console.log(user);
    if(user === undefined) {
        response.status(400);
        response.send("Invalid user");
    }
    else {
        const pass = await bcrypt.compare(password, user.password);
        if(pass === true) {
            const payload = {username: username, user_id: user.user_id};
            const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
            response.send({ jwtToken });
        }
        else {
            response.status(400);
            response.send("Invalid password");
        }
    }
});

//API 3
app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const getTweetsFeedQuery = `
        SELECT 
            username,
            tweet,
            date_time as dateTime
        FROM 
            follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN user ON user.user_id = follower.following_user_id
        WHERE 
            follower.follower_user_id = ${user_id}
        ORDER BY
            date_time DESC
        LIMIT 4;
    `;

  const tweetFeedArray = await db.all(getTweetsFeedQuery);
  response.send(tweetFeedArray);
});

//API 4
app.get("/user/following", authenticateToken ,async (request, response) => {
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const getFollowingQuery = `
    SELECT 
        name 
    from 
        user inner join follower 
    on 
        user.user_id = follower.following_user_id
    WHERE 
        follower_user_id = ${user_id};
    `;
    const getFollowing = await db.all(getFollowingQuery);
    response.send(getFollowing);
});

//API 5
app.get("/user/followers", authenticateToken ,async (request, response) => {
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const getFollowersQuery = `
    SELECT 
        name 
    from 
        user inner join follower 
    on 
        user.user_id = follower.follower_user_id
    WHERE 
        following_user_id = ${user_id};
    `;
    const getFollowers = await db.all(getFollowersQuery);
    response.send(getFollowers);
});

const isFollowing = async (request, response, next) => {
    const { tweetId } = request.params;
    const userId = request.payload.user_id;

    const followedUsersQuery = `
    SELECT
        user_id
    FROM
        user inner join follower
        on user.user_id = follower.following_user_id
    WHERE
        follower_user_id = ${userId};
    `;

    const followedUsers = await db.all(followedUsersQuery);

    const tweetUserQuery = `
    SELECT user_id
    from tweet
    where tweet_id = ${tweetId};
    `;

    const tweetUser = await db.get(tweetUserQuery);
    const tweetUserId = tweetUser.user_id;

    console.log(tweetUser);
    console.log(tweetUser.user_id);

    const isFollowing = followedUsers.some(
        (eachUser) => eachUser.user_id === tweetUserId
    );

    console.log(isFollowing);

    if(isFollowing === false) {
        response.status(401);
        response.send("Invalid Request");
    }
    else {
        next();
    }
};

//API 6
app.get("/tweets/:tweetId", authenticateToken, isFollowing ,async (request, response) => {
    const { tweetId } = request.params;
    const getTweetQuery = `
    SELECT
        tweet,
        count(like.tweet_id) as likes,
        (
            SELECT count(reply.tweet_id)
            FROM (
                tweet join reply
                on tweet.tweet_id = reply.tweet_id
            )
            WHERE tweet.tweet_id = ${tweetId}
        ) AS replies,
        date_time AS dateTime
    FROM
        tweet join like 
        on tweet.tweet_id = like.tweet_id
    WHERE
        tweet.tweet_id = ${tweetId};
    `;

    const tweetData = await db.get(getTweetQuery);
    response.send(tweetData);
});

//API 7
app.get("/tweets/:tweetId/likes", authenticateToken, isFollowing ,async (request, response) => {
    const { tweetId } = request.params;
    const getTweetLikedUsersQuery = `
    SELECT
        username
    FROM
        user
    WHERE
        user_id in 
        (
            SELECT 
                like.user_id
            FROM
                tweet join like
                on tweet.tweet_id = like.tweet_id
            WHERE
                tweet.tweet_id = ${tweetId}
        );
    `;

    const tweetLikedUsers = await db.all(getTweetLikedUsersQuery);
    
    const likedUsersArray = [];
    tweetLikedUsers.map((eachUser) => likedUsersArray.push(eachUser.username));

    response.send({
        likes: likedUsersArray,
    });
});

//API 8
app.get("/tweets/:tweetId/replies", authenticateToken, isFollowing ,async (request, response) => {
    const { tweetId } = request.params;
    const getRepliedUsersQuery = `
    SELECT
        user.name,
        reply
    FROM
        tweet join reply on tweet.tweet_id = reply.tweet_id
        join user on reply.user_id = user.user_id
    WHERE
        tweet.tweet_id = ${tweetId};
    `;

    const tweetRepliedUsers = await db.all(getRepliedUsersQuery);
    
    response.send({
        replies: tweetRepliedUsers,
    });
});

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
    console.log(request);
    const userId = request.payload.user_id;

    const getUserTweetsQuery = `
        SELECT
            tweet,
            count(like.tweet_id) as likes,
            (
                SELECT
                    count(reply.tweet_id)
                FROM
                    tweet join reply
                    on tweet.tweet_id = reply.tweet_id
                WHERE 
                    tweet.user_id = ${userId}
                GROUP BY
                    reply.tweet_id
            ) as replies,
            date_time as dateTime
        FROM
            tweet join like
            on tweet.tweet_id = like.tweet_id
        WHERE
            tweet.user_id = ${userId}
        GROUP BY
            like.tweet_id;
    `;

    const userTweets = await db.all(getUserTweetsQuery);
    response.send(userTweets);    
});

//API 10
app.post("/user/tweets", authenticateToken, async (request, response) => {
    const { tweetDetails } = request.body;
    const userId = request.payload.user_id;
    const date = format(new Date(date));
    console.log(date);
    const createTweetQuery = `
    INSERT into tweet
        (tweet, user_id, date_time)
    VALUES
        ('${tweetDetails}', ${userId}, '2023-08-18');
    `;
    await db.run(createTweetQuery);
    // console.log(addTweet.lastID);
    response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
    console.log(request);
    const { tweetId } = request.params;
    const userId = request.payload.user_id;

    const getTweet = `
    SELECT *
    FROM tweet
    WHERE tweet_id = ${tweetId};    
    `;

    const tweet = await db.get(getTweet);
    const tweetUserId = tweet.user_id;

    if(tweetUserId != userId) {
        response.status(401);
        response.send("Invalid Request");
    }
    else {
        const deleteTweetQuery = `
            DELETE from tweet
            WHERE tweet_id = ${tweetId};
        `; 
        await db.run(deleteTweetQuery);
        response.send("Tweet Removed");
    }
});

module.exports = app;