/**
 * @param {string} title
 * @return {string}
 */
function normaliseTitle (title)
{
    return title.toLowerCase().replace(/[:-\s]+/g, ' ');
}

/**
 * @param {Movie} movieA
 * @param {Movie} movieB
 * @return {boolean}
 */
export function movieMatches (movieA, movieB)
{
    const serviceMatch = movieA.services.some(
        (serviceA) => movieB.services.some(
            (serviceB) => serviceA.service === serviceB
                && serviceA.id === serviceB.id,
        ),
    );
    if (serviceMatch)
    {
        return true;
    }

    if (Math.abs(movieA.year - movieB.year) > 1)
    {
        return false;
    }

    return (
        normaliseTitle(movieA.title) === normaliseTitle(movieB.title)
    );
}
