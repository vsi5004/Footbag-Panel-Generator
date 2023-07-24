class Square extends Panel{
    constructor(side_len, bite, stitches, stitch_length, hole_diameter){
        const sides = [side_len, side_len, side_len, side_len];
        super(bite, stitches, hole_diameter, side_len, sides, false);
        this.width = side_len;
    }
}