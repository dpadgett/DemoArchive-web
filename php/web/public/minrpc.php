<?

if (isset($_GET['rpc']) && $_GET['rpc'] == 'endmatch') {
  header('Location: /minrpc.py?' . $_SERVER['QUERY_STRING']);
  exit;
}

require __DIR__ . '/vendor/autoload.php';

//$m = new MongoClient('mongodb://reader:nervou@sjc.jactf.com,pub.jactf.com,whoracle.jactf.com/demos?replicaSet=ctfpug', array('timeout' => 1000));
$m = new MongoClient('mongodb://mongodb');

$db = $m->demos;

$collection = $db->mindemos;
$matches = $db->minmatches;
$playerGames = $db->playerGames;

$rpc = NULL;
if (isset($_GET['rpc'])) {
  $rpc = $_GET['rpc'];
}

function format_result($result) {
  global $rpc;
  if (isset($_GET['jsonp'])) {
    return $rpc . ' = ' . json_encode($result) . ";\n";
  }
  return json_encode($result);
}

if (isset($_GET['jsonp'])) {
  header("Content-Type: text/javascript");
} else {
  header("Content-Type: application/json");
}

function rekey($data, $keymap) {
  foreach ($keymap as $min_key => $key) {
    if (isset($data[$min_key])) {
      $data[$key] = $data[$min_key];
      unset($data[$min_key]);
    }
  }
  return $data;
}

function inflate_scores($min_scores) {
  $min_scores = rekey($min_scores, array(
    'fi' => 'is_final',
    'rs' => 'red_score',
    'bs' => 'blue_score',
    'f' => 'freeplayers',
    'r' => 'redplayers',
    'b' => 'blueplayers',
    's' => 'specplayers'));
  $teams = array('freeplayers' => 'FREE', 'redplayers' => 'RED', 'blueplayers' => 'BLUE', 'specplayers' => 'SPECTATOR');
  foreach ($teams as $team => $teamval) {
    if (isset($min_scores[$team])) {
      foreach ($min_scores[$team] as &$player) {
        $player = rekey($player, array(
          'c' => 'client',
          'n' => 'client_name',
          's' => 'score',
          'p' => 'ping',
          't' => 'time'));
        $player['team'] = $teamval;
      }
    }
  }
  return $min_scores;
}

function add_player_link($players, $demos) {
  $added = array();
  foreach ($demos as &$demo) {
    $client = $demo['client_id'];
    if (isset($players[$client])) {
      $player = &$players[$client];
      $demo['player'] = (string) $player['_id']['player'];
      if (isset($player['rating'])) {
        $demo['rating'] = $player['rating'];
      }
      $added[$client] = True;
    }
  }
  foreach($players as $idx => &$player) {
    if (!isset($added[$idx])) {
      // calling this $demo will overwrite the last actual demo from loop above
      $newdemo = array('client_id' => $idx, 'name' => $player['names'][sizeof($player['names']) - 1]['name'], 'player' => (string) $player['_id']['player']);
      if (isset($player['rating'])) {
        $newdemo['rating'] = $player['rating'];
      }
      $demos[] = $newdemo;
    }
  }
  return $demos;
}

function inflate_map($min_map) {
  $map = $min_map;
  $map = rekey($map, array(
    'n' => 'mapname',
    's' => 'map_start_time',
    'e' => 'map_end_time',
    'sc' => 'scores'));
  if (isset($map['scores'])) {
    $map['scores'] = inflate_scores($map['scores']);
  }
  return $map;
}

function inflate($min_data) {
  $data = $min_data;
  $data['_id'] = '/cygdrive/U/demos/' . $data['_id'];
  $data = rekey($data, array(
    'p' => 'player',
    'ma' => 'is_match',
    'h' => 'match_hash',
    't' => 'time_created',
    'mt' => 'metadata_mtime',
    'm' => 'metadata'));
  $data['metadata'] = rekey($data['metadata'], array(
    'c' => 'client',
    'h' => 'sv_hostname',
    'm' => 'maps'));
  if (isset($data['metadata']['maps'])) {
    foreach ($data['metadata']['maps'] as &$map) {
      $map = inflate_map($map);
    }
  }
  return $data;
}

function inflate_match($min_data) {
  $data = $min_data;
  #$data['_id'] = '/cygdrive/U/demos/' . $data['_id'];
  $data = rekey($data, array(
    'd' => 'demos',
    's' => 'map_start_time',
    'e' => 'map_end_time',
    'n' => 'mapname',
    'sc' => 'scores',
    'h' => 'sv_hostname',
    't' => 'time_created',
    'ma' => 'is_match'));
  if (isset($data['demos'])) {
    foreach ($data['demos'] as &$demo) {
      $demo = rekey($demo, array(
        'c' => 'client_id',
        'n' => 'name'));
      $demo['id'] = '/cygdrive/U/demos/' . $demo['id'];
    }
  }

  global $playerGames;
  $cursor = $playerGames->find(array('_id.match' => $data['_id']), array());
  $players = array();
  foreach ($cursor as $player) {
    $players[$player['client_num']] = $player;
  }
  $data['demos'] = add_player_link($players, $data['demos']);

  if (isset($data['scores'])) {
    foreach ($data['scores'] as &$scores) {
      $scores = inflate_scores($scores);
    }
  }
  return $data;
}

function search($query) {
  global $collection;
  $keys = array(
    't',
    'p',
    'm.c.id',
    'm.h',
    'm.m.n',
    'm.m.s',
    'm.m.e',
    'm.m.sc',
    'm.m.teams'
  );
  $proj = array();
  foreach ($keys as $key) {
    $proj[$key] = 1;
  }
  $cursor = $collection->find($query, $proj);
  $offset = 0;
  if (isset($_GET['offset'])) {
    $offset = (int) $_GET['offset'];
  }
  $limit = 10;
  if (isset($_GET['limit'])) {
    $limit = (int) $_GET['limit'];
  }
  $cursor->sort(array('t' => -1));
  $count = $cursor->count();
  $cursor->skip($offset)->limit($limit);
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = inflate($doc);
  }
  return array('result' => $result, 'offset' => $offset, 'limit' => $limit, 'total' => $count);
}

function search_matches($query) {
  global $matches;
  $cursor = $matches->find($query, array());
  $offset = 0;
  if (isset($_GET['offset'])) {
    $offset = (int) $_GET['offset'];
  }
  $limit = 5;
  if (isset($_GET['limit'])) {
    $limit = (int) $_GET['limit'];
  }
  $cursor->sort(array('t' => -1));
  $count = $cursor->count();
  $cursor->skip($offset)->limit($limit);
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = inflate_match($doc);
  }
  return array('result' => $result, 'offset' => $offset, 'limit' => $limit, 'total' => $count);
}

function python($script, $input) {
  $descriptorspec = array(
     0 => array("pipe", "r"),  // stdin is a pipe that the child will read from
     1 => array("pipe", "w"),  // stdout is a pipe that the child will write to
     2 => array("pipe", "w"),   // stderr is a file to write to
  );

  $cwd = 'C:/cygwin';

  $process = proc_open('C:/cygwin/bin/python2.7.exe ' . $script, $descriptorspec, $pipes, $cwd, NULL);
  $output = '';

  if (is_resource($process)) {
      fwrite($pipes[0], $input);
      fclose($pipes[0]);

      $output = stream_get_contents($pipes[1]);
      fclose($pipes[1]);

      $output .= stream_get_contents($pipes[2]);
      fclose($pipes[2]);

      $return_value = proc_close($process);
      //echo "command returned $return_value\n";
      //return $return_value;
  }
  
  return $output;
}

if ($rpc == 'numdemos') {
  $result = array('numdemos' => $collection->count());
  echo format_result($result);
  exit;
} else if ($rpc == 'recentdemos') {
  $result = search(array());
  echo format_result($result);
  exit;
} else if ($rpc == 'search') {
  $query = array();
  if (isset($_GET['player'])) {
    $query['p'] = $_GET['player'];
  }
  if (isset($_GET['before'])) {
    $query['t'] = array('$lte' => new MongoDate(strtotime($_GET['before'] . ' America/New_York')));
  }
  if (isset($_GET['map'])) {
    $query['m.m'] = array('$elemMatch' => array('n' => $_GET['map']));
  }
  if (isset($_GET['server'])) {
    $query['m.h'] = $_GET['server'];
  }
  if (isset($_GET['match'])) {
    $query['ma'] = $_GET['match'] === 'true';
  }
  $result = search($query);
  echo format_result($result);
  exit;
} else if ($rpc == 'topnames') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->minnames->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'topmaps') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->minmaps->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'topservers') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->minservers->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'recentmatches') {
  $result = search_matches(array('ma' => True));
  echo format_result($result);
  exit;
} else if ($rpc == 'searchmatches') {
  $query = array();
  if (isset($_GET['before'])) {
    $query['t'] = array('$lte' => new MongoDate(strtotime($_GET['before'] . ' America/New_York')));
  }
  if (isset($_GET['map'])) {
    $query['n'] = $_GET['map'];
  }
  if (isset($_GET['server'])) {
    $query['h'] = $_GET['server'];
  }
  if (isset($_GET['match'])) {
    $query['ma'] = $_GET['match'] === 'true';
  }
  if (isset($_GET['player'])) {
    //$query['demos'] = array('$elemMatch' => array('name' => $_GET['player']));
    if (!array_diff(array_keys($query), array('ma', 't'))) {
      // duplicate it so that it uses the index
      $query = array('$or' => array(
          array_merge(array('sc.b.n' => $_GET['player']), $query),
          array_merge(array('sc.r.n' => $_GET['player']), $query),
          array_merge(array('sc.f.n' => $_GET['player']), $query),
          array_merge(array('sc.s.n' => $_GET['player']), $query)));
    } else {
      $query['$or'] = array(
          array('sc.b.n' => $_GET['player']),
          array('sc.r.n' => $_GET['player']),
          array('sc.f.n' => $_GET['player']),
          array('sc.s.n' => $_GET['player']));
    }
  }
  //var_dump($query);exit();
  $result = search_matches($query);
  echo format_result($result);
  exit;
} else if ($rpc == 'lookupmatch') {
  $result = search_matches(array('_id' => $_GET['id']));
  echo format_result($result);
  exit;
} else if ($rpc == 'lookupdemo') {
  $result = search(array('_id' => $_GET['id']));
  echo format_result($result);
  exit;
} else if ($rpc == 'endmatch') {
  // called at scoreboard of a match, or if no scoreboard, on map change.
  // returns json of the match.
  $input = array('demo' => $_GET['demo']);
  $result = python('C:/cygwin/home/dan/endmatch2.py', json_encode($input));
  echo $result;
  exit;
} else if ($rpc == 'searchplayer') {
  $searchplayers = array();
  if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $searchplayers = json_decode(file_get_contents('php://input'));
  } else {
    $searchplayers[] = array($_GET['id1'], $_GET['id2']);
  }
  $results = array();
  foreach ($searchplayers as $idx => $player) {
    $ip_hash = $player[0];
    $guid_hash = $player[1];
    $result = search_players(array('$or' => array(array('ip_hash.ip' => (int) $ip_hash), array('guid_hash.guid' => (int) $guid_hash))), "resorted_player");

    $player_match_cmp = player_match_cmp($ip_hash, $guid_hash);
    usort($result['result'], $player_match_cmp);
    $result['result'] = array_map("summarize_player", $result['result']);
    $results[$idx] = $result;
  }

  echo format_result($results);
  exit;
}

?>
