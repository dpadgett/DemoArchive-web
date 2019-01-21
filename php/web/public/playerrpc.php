<?

if (isset($_GET['rpc']) && $_GET['rpc'] == 'teams') {
  header('Location: /playerrpc.py?' . $_SERVER['QUERY_STRING']);
  exit;
}

require __DIR__ . '/vendor/autoload.php';

//$m = new MongoClient('mongodb://reader:nervou@sjc.jactf.com,pub.jactf.com,whoracle.jactf.com/demos?replicaSet=ctfpug', array('timeout' => 1000));
$m = new MongoClient('mongodb://mongodb');

$db = $m->demos;

$collection = $db->mindemos;
$matches = $db->minmatches;
$players = $db->players;
$playerGames = $db->playerGames;

$rpc = NULL;
if (isset($_GET['rpc'])) {
  $rpc = $_GET['rpc'];
} else if (isset($_POST['rpc'])) {
  $rpc = $_POST['rpc'];
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
  if (isset($data['scores'])) {
    foreach ($data['scores'] as &$scores) {
      $scores = inflate_scores($scores);
    }
  }
  return $data;
}

function cmp_time($a, $b) {
  return trunc_result($b['time'] - $a['time']);
}

function summarize_player($full_player) {
  $player = array('_id' => $full_player['_id'], 'time' => 0);
  if (isset($full_player['names'])) {
    usort($full_player['names'], "cmp_time");
    foreach ($full_player['names'] as $name) {
      if (!isset($player['name'])
          and $name['name'] != "Padawan"
          and $name['name'] != "padawan"
          and 0 === preg_match('/^Padawan ^7\(^5[0-9]+^7\)$/', $name['name'])) {
        $player['name'] = $name['name'];
      }
      $player['time'] += $name['time'];
    }
    if (!isset($player['name'])) {
      $player['name'] = "(default) " . $full_player['names'][0]['name'];
    }
  }
  if (isset($full_player['matches'])) {
    $player['last_match'] = end($full_player['matches']);
    reset($full_player['matches']);
  }
  $player['num_matches'] = $full_player['num_matches'];
  if (isset($full_player['rating'])) {
    $player['rating'] = $full_player['rating'];
  }
  return $player;
}

function inflate_player($min_player) {
  $player = $min_player;
  // full player is too much to send down, prune to top x in each category
  $keys = array('names', 'ip_hash', 'guid_hash');
  foreach ($keys as $key) {
    if (isset($player[$key])) {
      usort($player[$key], "cmp_time");
    }
  }
  foreach ($keys as $key) {
    if (isset($player[$key])) {
      $player[$key] = array_slice($player[$key], 0, 10);
    }
  }
  if (isset($player['matches'])) {
    $player['matches'] = array_slice($player['matches'], -10, 10);
  }
  return $player;
}

function full_player($player) {
  if (!isset($player['matches'])) {
    global $playerGames;
    $cursor = $playerGames->find(array('_id.player' => $player['_id']/*, 'is_match' => true*/));
    $cursor->sort(array('time' => 1));
    $player['matches'] = array();
    foreach ($cursor as $doc) {
      $player['matches'][] = $doc;
    }
  }
  return $player;
}

function resorted_player($player) {
  update_player($player);
  //unset($player['matches']);
  /*$player = $player['names'];
  foreach ($player as &$name) {
    $name['type'] = gettype($name['time']);
  }*/
  /*$lastname = $player[sizeof($player)-1];
  $player[] = array('1vLast' => time_desc_cmp($player[0], $lastname));
  $player[] = array('1v2' => time_desc_cmp($player[0], $player[1]));
  $player[] = array('d1vLast' => time_double_desc_cmp($player[0], $lastname));
  $player[] = array('d1v2' => time_double_desc_cmp($player[0], $player[1]));*/
  return $player;
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

function search_players($query, $inflater) {
  global $players;
  $cursor = $players->find($query, array());
  $offset = 0;
  if (isset($_GET['offset'])) {
    $offset = (int) $_GET['offset'];
  }
  $limit = 25;
  if (isset($_GET['limit'])) {
    $limit = (int) $_GET['limit'];
  }
  $cursor->sort(array('num_matches' => -1));
  $count = $cursor->count();
  $cursor->skip($offset)->limit($limit);
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = call_user_func($inflater, $doc);
  }
  return array('result' => $result, 'offset' => $offset, 'limit' => $limit, 'total' => $count);
}

function search_min_players($query) {
  $results = search_players($query, "summarize_player");
  return $results;
}

function &find_player_property(&$props, $prop_name, $prop_value) {
  foreach ($props as &$prop) {
    if ($prop[$prop_name] == $prop_value) {
      return $prop;
    }
  }
  unset($prop);
  $prop = array($prop_name => $prop_value, 'time' => 0);
  $props[] = $prop;
  return $props[sizeof($props) - 1];
}

// needed to handle integer wraparound
function trunc_result($res) {
  if ($res > 0) {
    return 1;
  } elseif ($res < 0) {
    return -1;
  }
  return 0;
}

function time_desc_cmp(&$a, &$b) {
  return trunc_result($b['time'] - $a['time']);
}

function time_asc_cmp(&$a, &$b) {
  return trunc_result($a['time']->sec - $b['time']->sec);
}

function is_match(&$game) {
  return $game['is_match'];
}

function update_player(&$player) {
  usort($player['ip_hash'], "time_desc_cmp");
  $player['num_ips'] = sizeof($player['ip_hash']);
  if (isset($player['guid_hash'])) {
    usort($player['guid_hash'], "time_desc_cmp");
    $player['num_guids'] = sizeof($player['guid_hash']);
  } else {
    $player['num_guids'] = 0;
  }
  usort($player['names'], "time_desc_cmp");
  $player['num_names'] = sizeof($player['names']);
  //usort($player['matches'], "time_asc_cmp");
  if (isset($player['matches'])) {
    unset($player['matches']);
  }
  //$player['num_games'] = sizeof($player['matches']);
  //$player['num_matches'] = sizeof(array_filter($player['matches'], "is_match"));
}

function merge_players(&$player1, $player2) {
  if (isset($player2['ip_hash'])) {
    foreach ($player2['ip_hash'] as &$ip) {
      $player_ip = &find_player_property($player1['ip_hash'], 'ip', $ip['ip']);
      $player_ip['time'] += $ip['time'];
      unset($player_ip);
    }
  }
  if (isset($player2['guid_hash'])) {
    foreach ($player2['guid_hash'] as &$guid) {
      $player_guid = &find_player_property($player1['guid_hash'], 'guid', $guid['guid']);
      $player_guid['time'] += $guid['time'];
      unset($player_guid);
    }
  }
  if (isset($player1['matches'])) {
    unset($player1['matches']);
  }
  global $playerGames;
  $cursor = $playerGames->find(array('_id.player' => $player2['_id']));
  foreach (iterator_to_array($cursor, false) as $playergame) {  // materialize cursor contents so it does not have concurrent delete issues
    $playerGames->remove(array('_id' => $playergame['_id']));
    $playergame['_id']['player'] = $player1['_id'];
    $playerGames->save($playergame);
    $player1['num_games'] += 1;
    if ($playergame['is_match']) {
      $player1['num_matches'] += 1;
    }
  }
  /*
  foreach ($player2['matches'] as &$summary2) {
    $had_match = False;
    foreach ($player1['matches'] as &$summary) {
      if ($summary['id'] == $summary2['id'] and $summary['client_num'] == $summary2['client_num']) {
        //echo 'Player1 already has match';
        $had_match = True;
        break;
      }
    }
    if ($had_match) {
      continue;
    }
    $player1['matches'][] = $summary2;
  }
  */
  if (isset($player2['names'])) {
    foreach ($player2['names'] as &$name) {
      $player_name = &find_player_property($player1['names'], 'name', $name['name']);
      $player_name['time'] += $name['time'];
      unset($player_name);
    }
  }
  update_player($player1);
}

function match_time($ip_hash, $guid_hash) {
  return function($player) use ($ip_hash, $guid_hash) {
    $result = 0;
    foreach($player['ip_hash'] as $ip) {
      if ($ip['ip'] == $ip_hash) {
        $result += $ip['time'];
      }
    }
    foreach($player['guid_hash'] as $guid) {
      if ($guid['guid'] == $guid_hash) {
        $result += 100 * $guid['time'];
      }
    }
    return $result;
  };
}

function player_match_cmp($ip_hash, $guid_hash) {
  $match_time = match_time($ip_hash, $guid_hash);
  return function(&$player1, &$player2) use ($match_time) {
    return trunc_result($match_time($player2) - $match_time($player1));
  };
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

function check_merge_ok() {
  return $_SERVER['REMOTE_ADDR'] == '127.0.0.1' or $_SERVER['REMOTE_ADDR'] == '89.132.165.81' or $_SERVER['REMOTE_ADDR'] == '198.27.210.37'; //'213.222.142.133';
}

if ($rpc == 'topplayers') {
  $result = search_min_players(array());
  echo format_result($result);
  exit;
} else if ($rpc == 'searchplayers') {
  $result = search_min_players(array('names.name' => $_GET['name']));
  echo format_result($result);
  exit;
} else if ($rpc == 'endmatch') {
  if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    die('Must use POST');
  }
  $input = file_get_contents('php://input');
  $result = python('C:/cygwin/home/dan/endmatch.py', $input);
  die($result);
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
} else if ($rpc == 'teams') {
  //var_dump($_GET);
  $teams = array('RED' => array(), 'BLUE' => array());
  foreach(array('RED', 'BLUE') as $team) {
    if (isset($_GET[$team.'_id1']) && isset($_GET[$team.'_id2']) && sizeof($_GET[$team.'_id1']) == sizeof($_GET[$team.'_id2'])) {
      for($idx = 0; $idx < sizeof($_GET[$team.'_id1']); $idx += 1) {
        $ip_hash = $_GET[$team.'_id1'][$idx];
        $guid_hash = $_GET[$team.'_id2'][$idx];
        $result = search_min_players(array('$or' => array(array('ip_hash.ip' => (int) $ip_hash), array('guid_hash.guid' => (int) $guid_hash))));
        if (isset($result['result'][0]['rating']['raw'])) {
          $rating = $result['result'][0]['rating']['raw'];
          $teams[$team][] = $rating['mu'] . ',' . $rating['sigma'];
        } else {
          $teams[$team][] = 'unknown';
        }
      }
    }
  }
  //var_dump($teams);
  $command = 'python C:/cygwin/home/dan/teams.py R ' . implode(' ', $teams['RED']) . ' B ' . implode(' ', $teams['BLUE']);
  //echo $command."\n";
  system($command);
} else if ($rpc == 'lookup') {
  $result = search_players(array('_id' => new MongoId($_GET['id'])), "full_player");
  echo format_result($result);
  exit;
} else if ($rpc == 'checkmerge') {
  if (!check_merge_ok()) {
    die(format_result(False));
  }
  die(format_result(True));
} else if ($rpc == 'mergeplayers') {
  if (!check_merge_ok()) {
    die("No.");
  }
  $ids = $_POST['ids'];
  $id1 = $ids[0];
  $player1 = $players->find(array('_id' => new MongoId($id1)), array())->getNext();
  foreach ($ids as $id2) {
    if ($id1 == $id2) {
      continue;
    }
    $player2 = $players->find(array('_id' => new MongoId($id2)), array())->getNext();
    //var_dump(array($id1, $id2));
    merge_players($player1, $player2);
    $players->remove(array('_id' => new MongoId($id2)));
  }
  $players->save($player1);
  echo format_result(array('id' => $id1, 'player' => $player1));
  exit;
} else if ($rpc == 'debugplayer') {
  $ip_hash = $_GET['id1'];
  $guid_hash = $_GET['id2'];
  $result = search_players(array('$or' => array(array('ip_hash.ip' => (int) $ip_hash), array('guid_hash.guid' => (int) $guid_hash))), "resorted_player");
  
  $player_match_cmp = player_match_cmp($ip_hash, $guid_hash);
  usort($result['result'], $player_match_cmp);
  //$result['result'] = array_map("summarize_player", $result['result']);
  
  echo format_result($result);
  if (isset($_GET['update'])) {
    $player1 = $result['result'][0];
    $players->save($player1);
  }
  exit;
}
?>
