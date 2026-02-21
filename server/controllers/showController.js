import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

//API to get now playing movies from TMDB API
export const getNowPlayingMovies = async(req,res)=>{
    try{
        const {data} = await axios.get('https://api.themoviedb.org/3/movie/now_playing',{
            headers:{Authorization: `Bearer ${process.env.TMDB_API_KEY}`}
        })

    
    const movies=data.results;
    res.json({success:true, movies:movies})
    }catch(error){
        console.error(error);
        res.json({success: false, message:error.message})
    }
}

//API to add a new show to the database
export const addShow=async(req,res)=>{
    try{
        const {movieId, showsInput,showPrice}=req.body
        let movie= await Movie.findById(movieId)

        if(!movie){
            //fetch movie details and credits from TMDB API
            const [movieDetailsResponse, movieCreditsResponse]=await Promise.all([axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, { headers:{Authorization: `Bearer ${process.env.TMDB_API_KEY}`}}),

                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`,  {headers:{Authorization: `Bearer ${process.env.TMDB_API_KEY}`}})
            ]);
            const movieApiData= movieDetailsResponse.data;
            const movieCreditsData= movieCreditsResponse.data;

            const movieDetails={
                _id:movieId ,
                title:movieApiData.title, 
                overview: movieApiData.overview,
                poster_path:movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.cast,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime,
    
            }
            // Add movie to the database 
            movie = await Movie.create(movieDetails);
 
        }

        const showsToCreate = [];
        showsInput.forEach(show =>{
            const showDate=show.date;
            show.time.forEach((time)=>{
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie:movieId,
                    showDateTime:new Date(dateTimeString),
                    showPrice,
                    occupiedSeats:{}
                })
            })
        });

        if(showsToCreate.length > 0){
            await Show.insertMany(showsToCreate);
        }

        //Trigger Inngest event
        await inngest.send({
            name:"app/show.added",
            data:{movieTitle:movie.title}
        })

        res.json({success: true, message:'Show Added successfully.'})
    }
    catch(error){
        console.error(error);
        res.json({success:false, message:error.message})
    }
}


//API to get all shows from the database
export const getShows = async(req,res)=> {
    try {
        const shows = await Show.find().populate('movie')
        //filter unique shows

        const uniqueMovies = {};

     shows.forEach(show => {
    if (!uniqueMovies[show.movie._id]) {
        uniqueMovies[show.movie._id] = show.movie;
    }
});

res.json({ success: true, shows: Object.values(uniqueMovies) });

    } catch (error) {
        console.error(error);
        res.json({success: false, message:error.message});
        
    }
}

//API to get a single show from the database
export const getShow = async (req, res) => {
try {
    const { movieId } = req.params;

    // Get all shows
    const shows = await Show.find();

    // Trim both sides before comparing
    const filteredShows = shows.filter(
      show => show.movie.toString().trim() === movieId.trim()
    );

    if (!filteredShows.length) {
      return res.json({
        success: false,
        message: "No shows found for this movie."
      });
    }

    const movie = await Movie.findById(movieId.trim());
    const dateTime = {};

    filteredShows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];

      if (!dateTime[date]) {
        dateTime[date] = [];
      }

      dateTime[date].push({
        time: show.showDateTime,
        showId: show._id
      });
    });

    res.json({ success: true, movie, dateTime });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};







// const allShows = await Show.find();
// console.log("Total shows in DB:", allShows.length);
// console.log("All movie values:", allShows.map(s => s.movie));

// return res.json({ success: true, allShows });


// };
