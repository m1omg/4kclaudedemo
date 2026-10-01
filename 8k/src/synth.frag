#version 330
// placeholder
out vec4 o;
vec2 song(int i) { return vec2(sin(float(i) * .0627) * .1); }
void main()
{
	int i = (int(gl_FragCoord.y) * 1024 + int(gl_FragCoord.x)) * 2;
	o = vec4(song(i), song(i + 1));
}
