
function rpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'GET',
    url: 'rpc.php',
    data: alldata,
    dataType: 'json',
  }).done(callback);
}

function Q_IsColorString(str, idx)
{
  return str[idx] == '^' && str[idx + 1] != '^' && str[idx + 1] <= '9' && str[idx + 1] >= '0';
}
function Q_CleanStr(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else if (str.charCodeAt(idx) >= 0x20 && str.charCodeAt(idx) <= 0x7E) {
      dest += str[idx];
    }
  }
  return dest;
}

function colorToHex(color)
{
  return sprintf("%02X%02X%02X",
      parseInt(color[0] * 255 * 0.75),
      parseInt(color[1] * 255 * 0.75),
      parseInt(color[2] * 255 * 0.75));
}

function colorize(str) {
  var g_color_table = [
    [0, 0, 0, 1],			// CT_BLACK
    [1, 0, 0, 1],			// CT_RED
    [0, 1, 0, 1],			// CT_GREEN
    [1, 1, 0, 1],			// CT_YELLOW
    [0, 0, 1, 1],			// CT_BLUE
    [0, 1, 1, 1],			// CT_CYAN
    [1, 0, 1, 1],			// CT_MAGENTA
    [1, 1, 1, 1],			// CT_WHITE
  ];

  var def = g_color_table[0];
  // draw the colored text
  var out = '<span style="color:#"' + colorToHex(def) + '">';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      var color = parseInt(str[idx + 1]);
      if (color > 7 || color < 0) {
        color = 0;
      }
      out += '</span><span style="color:#' + colorToHex(g_color_table[parseInt(color) % g_color_table.length]) + '">';
      idx++;
      continue;
    }
    out += str[idx];
  }
  out += '</span>';

  return out;
}

function search(offset, limit)
{
  var data = { 'offset': offset, 'limit': limit };
  var player = $('input[name="player"]').val();
  if (player != '') {
    data['player'] = player;
  }
  var before = $('input[name="before"]').val();
  if (before != '') {
    data['before'] = before;
  }
  var map = $('input[name="map"]').val();
  if (map != '') {
    data['map'] = map;
  }
  var server = $('input[name="server"]').val();
  if (server != '') {
    data['server'] = server;
  }
  var match = $('input[name="match"]').prop("checked");
  if (match) {
    data['match'] = match;
  }
  rpc('search', data, function(response) {
    $('#searchresult').text('Results');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], false, offset);
    }
    writePagination(search, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

function writeDemoRow(demo, relativeTime, offset)
{
  relativeTime = typeof relativeTime !== 'undefined' ? relativeTime : false;
  var time_created_millis = demo['time_created']['sec'] * 1000 + demo['time_created']['usec'] / 1000;
  if (relativeTime) {
    var time_created_str = moment(time_created_millis).fromNow();
  } else {
    var time_created_str = moment(time_created_millis).format("dddd, MMMM Do YYYY, h:mm:ss a");
  }
  var filename = demo['_id'].split(/(\/|\\)/);
  filename = filename[filename.length - 1];
  var player = '';
  if ('player' in demo) {
    player = demo['player'];
  }
  var metadata = demo['metadata'];
  var totaltime_millis = 0;
  var clientid = metadata['client']['id'];
  var allmapcells = [];
  $.each(metadata['maps'], function(idx, map) {
    var mapcells = [];
    mapcells.push(map['mapname']);
    var maptime = map['map_end_time'] - map['map_start_time'];
    totaltime_millis += maptime;
    mapcells.push(moment.duration(maptime).humanize());
    var team = '';
    if ('scores' in map) {
      var scores = map['scores'];
      $.each(['free', 'red', 'blue', 'spec'], function(idx, curteam) {
        key = curteam + 'players';
        if (key in scores) {
          $.each(scores[key], function(idx, player) {
            if (player['client'] == clientid) {
              team = curteam.toUpperCase();
            }
          });
        }
      });
    }
    mapcells.push(team);
    var teamScores = ['', '', '', ''];
    if ('scores' in map) {
      var scores = map['scores'];
      if ('is_final' in scores) {
        if (scores['is_final'] == 1) {
          mapcells.push('Final');
        } else {
          mapcells.push('Not Final');
        }
      } else {
        mapcells.push('');
      }
      if ('red_score' in scores) {
        teamScores[0] = scores['red_score'];
      }
      if ('blue_score' in scores) {
        teamScores[1] = scores['blue_score'];
      }
      var players = {
        'red': [],
        'blue': [],
        'free': [],
        'spectator': [],
      };
      var playerdedup = {};
      var playerbuilder = function(key) {
        return function(idx, player) {
          if (!(player['client'] in playerdedup)) {
            playerdedup[player['client']] = true;
            players[key].push([
              player['time'],
              colorize(player['client_name']),
              player['score'],
              player['ping'],
            ]);
          };
        };
      };
      if ('redplayers' in scores) {
        $.each(scores['redplayers'], playerbuilder('red'));
      }
      if ('blueplayers' in scores) {
        $.each(scores['blueplayers'], playerbuilder('blue'));
      }
      if ('freeplayers' in scores) {
        $.each(scores['freeplayers'], playerbuilder('free'));
      }
      if ('specplayers' in scores) {
        $.each(scores['specplayers'], playerbuilder('spectator'));
      }
    } else {
      mapcells.push('');
      mapcells.push('');
      mapcells.push('');
    }
    allmapcells.push({'mapcells': mapcells, 'players': players, 'teamScores': teamScores});
  });
  var redscore = '';
  var bluescore = '';
  var totaltime = moment.duration(totaltime_millis).humanize();
  var hostname = '';
  if ('sv_hostname' in metadata) {
    hostname = Q_CleanStr(metadata['sv_hostname'])
  }
  var url = '<a href="getdemo.php?demo=' + encodeURIComponent(demo['_id']) + '">Link</a>';

  var cells = [
    hostname,
    colorize(player),
    time_created_str,
    totaltime,
    url,
  ];
  var maxScoreRows = function(scores) {
    var maxRows = 0;
    for (var key in scores) {
      maxRows = Math.max(maxRows, scores[key].length);
    }
    return Math.max(0, maxRows);
  };
  var totalRows = function(allmapcells) {
    var total = 0;
    $.each(allmapcells, function(idx, mapcells) {
      total += maxScoreRows(mapcells['players']) + 1;
    });
    return total;
  }
  var row = $('<tr>');
  for (var i = 0; i < cells.length; i++) {
    row.append($('<td>' + cells[i] + '</td>').attr('rowspan', totalRows(allmapcells)));
  }
  var rowWritten = false;
  var rowStyles = ['', 'background-color:#e0e0e0'];
  var rowCount = 0;
  for (var i = 0; i < allmapcells.length; i++) {
    var style = rowStyles[(offset + i) % 2];
    rowWritten = false;
    var mapcells = allmapcells[i]['mapcells'];
    var players = allmapcells[i]['players'];
    var teamScores = allmapcells[i]['teamScores'];
    for (var j = 0; j < mapcells.length; j++) {
      row.append($('<td>' + mapcells[j] + '</td>').attr('rowspan', maxScoreRows(players) + 1).attr('style', style));
    }
    {
      for (var j = 0; j < 4; j++) {
        row.append($('<td>' + teamScores[j] + '</td>').attr('colspan', 4).attr('style', style));
      }
      $('#recentdemos tr:last').after(row);
      rowWritten = true;
      row = $('<tr>');
    }
    for (var j = 0; j < maxScoreRows(players); j++) {
      for (var key in players) {
        var player = ['', '', '', ''];
        if (players[key].length > j) {
          player = players[key][j];
        }
        $.each(player, function(idx, text) {
          row.append($('<td>' + text + '</td>').attr('style', style));
        });
      }
      $('#recentdemos tr:last').after(row);
      rowWritten = true;
      row = $('<tr>');
    }
    if (!rowWritten) {
      $('#recentdemos tr:last').after(row);
      rowWritten = true;
    }
    row = $('<tr>');
  }
  if (!rowWritten) {
    $('#recentdemos tr:last').after(row);
  }
  return offset + allmapcells.length;
}

function writePagination(rpc, count, curOffset, limit)
{
  curOffset -= curOffset % limit;
  var linkOffsets = [];
  // 4 links on each side: [0][1][2] [...] [3][*4*][5] [...] [6][7][8]
  // left side
  var numLinks = 0;
  var offset = 0;
  for (; offset < curOffset - limit && numLinks < 3; offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  if (offset < curOffset - limit) {
    linkOffsets.push(-1);
    offset = Math.max(0, curOffset - limit);
  }
  for (; offset <= Math.min(count, curOffset + limit); offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  var remainingLinks = 8 - numLinks;
  var minOffset = (count - (count % limit)) - remainingLinks * limit;
  if (offset < minOffset) {
    linkOffsets.push(-1);
    offset = Math.max(offset, minOffset);
  }
  for (; offset < count; offset += limit) {
    linkOffsets.push(offset);
  }
  $('span#page').find('a').remove();
  for (var idx = 0; idx < linkOffsets.length; idx++) {
    var offset = linkOffsets[idx];
    if (offset == -1) {
      var node = $('<a></a>').text(' ... ');
    } else {
      var node = $('<a>[' + offset + '-' + Math.min(count, offset + limit - 1) + ']</a>');
      if (offset <= curOffset && offset + limit > curOffset) {
        // not a link
      } else {
        node.attr('href', '#');
        var f = function() {
          var offset_ = offset;
          var limit_ = limit;
          node.click(function(e) {
            e.preventDefault();
            rpc(offset_, limit_);
            return false;
          });
        }();
      }
    }
    $('span#page').append(node);
  }
}

function recentDemos(offset, limit)
{
  var data = { 'offset': offset, 'limit': limit };
  rpc('recentdemos', data, function(response) {
    $('#searchresult').text('Recent demos:');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], true, offset);
    }
    writePagination(recentDemos, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

$(document).ready(function()
{
  var header = $('#recentdemos').find('tr:eq(0)');
  var scoreheaders = [
    'Time',
    'Name',
    'Score',
    'Ping',
  ];
  var teams = [
    'Red',
    'Blue',
    'Free',
    'Spec',
  ];
  var tds = $($('#recentdemos').find('tr:eq(0)')[0]).find('td');
  $.each(tds, function(idx, td) {
    $(td).attr('rowspan', 2);
  });
  $.each(teams, function(idx, team) {
    header.append($('<td>' + team + '</td>').attr('colspan', scoreheaders.length));
  });
  header = $('<tr>');
  $.each(teams, function(idx, team) {
    $.each(scoreheaders, function(idx, scoreheader) {
      header.append($('<td>' + scoreheader + '</td>'));
    });
  });
  $('#recentdemos tr:last').after(header);
  $('form#search').attr('onSubmit', 'search(0, 10); return false;');
  // for initializing elements on the page, the rpcs should be done on page load as jsonp instead of async
  $('#numdemos').text('' + numdemos['numdemos']);
  var offset = 0;
  for (var idx = 0; idx < recentdemos.result.length; idx++) {
    offset = writeDemoRow(recentdemos.result[idx], true, offset);
  }
  writePagination(recentDemos, parseInt(recentdemos.total), parseInt(recentdemos.offset), parseInt(recentdemos.limit));
  $('input[name="player"]').autocomplete({
    source: topnames,
    minLength: 2
  });
  $('input[name="before"]').datepicker({
    dateFormat: 'yy-mm-dd',
  });
  $('input[name="map"]').autocomplete({
    source: topmaps,
    minLength: 1
  });
  $('input[name="server"]').autocomplete({
    source: topservers,
    minLength: 1
  });
})
