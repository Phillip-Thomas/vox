with ranked_forage as (
  select
    ctid,
    row_number() over (
      partition by room_id, world_id, coord
      order by taken_at asc, collectible_type asc
    ) as claim_rank
  from world_collectibles
  where collectible_type = 'forage'
     or collectible_type like 'forage:%'
)
delete from world_collectibles as collectible
using ranked_forage
where collectible.ctid = ranked_forage.ctid
  and ranked_forage.claim_rank > 1;

update world_collectibles
set collectible_type = 'forage'
where collectible_type like 'forage:%';
