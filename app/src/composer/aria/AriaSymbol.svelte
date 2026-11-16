<script lang="ts">
  // Exact Android vectors shipped by Aria, not approximate application icons.
  let {name,size=18}:{name:string;size?:number}=$props();
</script>
<span class="aria-symbol" aria-hidden="true" style={'width:'+size+'px;height:'+size+'px;-webkit-mask-image:url("/aria-symbols/'+name+'.svg");mask-image:url("/aria-symbols/'+name+'.svg")'}></span>
<style>.aria-symbol{display:inline-block;flex:none;background:currentColor;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;}</style>
