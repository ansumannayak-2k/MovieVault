// Sample OMDb responses used by tests

export const SEARCH_OK = {
    Response: "True",
    Search: [
      {
        Title: "Mission: Impossible",
        Year: "1996",
        imdbID: "tt0117060",
        Type: "movie",
        Poster: "https://example.com/poster1.jpg"
      },
      {
        Title: "Mission: Impossible - Ghost Protocol",
        Year: "2011",
        imdbID: "tt1229238",
        Type: "movie",
        Poster: "https://example.com/poster2.jpg"
      }
    ],
    totalResults: "2"
  };
  
  export const DETAILS_OK_TT0117060 = {
    Response: "True",
    Title: "Mission: Impossible",
    Year: "1996",
    imdbID: "tt0117060",
    Poster: "https://example.com/poster1.jpg",
    Released: "1996-05-22"
  };
  