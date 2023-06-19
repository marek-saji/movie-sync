export type Service = 'mubi' | 'trakt.tv' | 'tmdb' | 'imdb'

export interface MovieInService
{
    service: Service;
    id: string;
    url: string;
}

export interface Movie
{
    title: string;
    year: number;
    services: Array<MovieInService>;
}

export interface ViewLogEntry
{
    time: Date;
    movie: Movie;
}

export type ViewLog = Array<ViewLogEntry>
