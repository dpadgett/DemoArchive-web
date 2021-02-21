
function rpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'GET',
    //url: 'minrpc.php',
    url: 'minrpc.py',
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
function strip_colors(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else {
      dest += str[idx];
    }
  }
  return dest;
}
function matchColorInsensitive(values) {
  return function( request, response ) {
    var matcher = new RegExp( $.ui.autocomplete.escapeRegex( request.term ), "i" );
    response( $.grep( values, function( value ) {
      value = value.label || value.value || value;
      return matcher.test( value ) || matcher.test( strip_colors( value ) );
    }) );
  };
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
    data['before'] = moment(before, "YYYY-MM-DD").toDate() / 1000;
  }
  var map = $('input[name="map"]').val();
  if (map != '') {
    data['map'] = map;
  }
  var server = $('input[name="server"]').val();
  if (server != '') {
    data['server'] = server;
  }
  data['match'] = $('input[name="match"]').prop('checked');
  var hashdata = $.extend({'rpc': 'search'}, data);
  window.location.hash = $.param(hashdata);
  rpc('searchmatches', data, function(response) {
    $('#searchresult').text('Results');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], false, offset);
    }
    writePagination(search, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

function lookup(id)
{
  var data = { 'id': id };
  var hashdata = $.extend({'rpc': 'lookup'}, data);
  window.location.hash = $.param(hashdata);
  rpc('lookupmatch', data, function(response) {
    $('#searchresult').text('Results');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], false, offset);
    }
    // removes any pagination
    $('span#page').find('a').remove();
  });
}

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}

function writeDemoRow(demo, relativeTime, offset)
{
  relativeTime = typeof relativeTime !== 'undefined' ? relativeTime : false;
  var time_created_millis = demo['time_created']['sec'] * 1000 + demo['time_created']['usec'] / 1000;
  if ('$date' in demo['time_created']) {
    time_created_millis = demo['time_created']['$date'];
  }
  if (relativeTime) {
    var time_created_str = moment(time_created_millis).fromNow();
  } else {
    var time_created_str = moment(time_created_millis).format("dddd, MMMM Do YYYY, h:mm:ss a");
  }
  var allmapcells = [];
  var hostname = '';
  if ('sv_hostname' in demo) {
    hostname = Q_CleanStr(demo['sv_hostname'])
  }
  var cells = [
    '<a href="#rpc=lookup&id=' + demo['_id'] + '" onclick="lookup(\'' + demo['_id'] + '\');">Link</a>',
    hostname,
    time_created_str,
    demo['mapname'],
    //'{{SCORES}}',
    moment.duration(demo['map_end_time'] - demo['map_start_time']).humanize()
  ];
  var teamScores = ['', '', '', ''];
  var fileMap = {};
  $.each(demo['demos'], function(idx, file) {
    fileMap[file['client_id']] = file;
  });
  if ('scores' in demo && demo['scores'].length > 0) {
    var scores;
    $.each(demo['scores'], function(idx, curscores) {
      if (curscores['is_final'] == 1) {
        scores = curscores;
      }
    });
    if (typeof scores === 'undefined') {
      scores = demo['scores'][0];
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
    var playerbuilder = function(_, player) {
      if (!(player['client'] in playerdedup)) {
        playerdedup[player['client']] = true;
        var demolink = '';
        var clientKey = '' + player['client'];
        //console.log(player);
        var playerName = colorize(escapeHtml(player['client_name']));
        if (clientKey in fileMap) {
          demolink = '<a href="getdemo.php?demo=' + encodeURIComponent(fileMap[clientKey]['id']) + '">Link</a>';
          if ('player' in fileMap[clientKey]) {
            playerName = '<a href="aplayer2.html#id=' + encodeURIComponent(fileMap[clientKey]['player']) + '" style="color: black;">' + playerName + '</a>';
            if ('rating' in fileMap[clientKey]) {
              var elo = function(rating) {
                return ~~((rating['friendly'] * 100));
              }
              playerName = playerName + ' (' + elo(fileMap[clientKey]['rating']['start']) + ' - ' + elo(fileMap[clientKey]['rating']['updated']) + ')';
            }
          }
          var formatTime = function(time) {
            var seconds = (Math.floor(time / 1000) % 60);
            if (seconds < 10) {
              seconds = "0" + seconds;
            }
            return (Math.floor(time / 1000 / 60)) + ":" + seconds;
          };
          var extralinks = [];
          if ('ns' in fileMap[clientKey]) {
            $.each(fileMap[clientKey]['ns'], function(idx, shot) {
              var time = formatTime(shot.time);
              var score = Math.round(((shot.score - 1) * 10) + 1);
            extralinks.push({time: shot.time, link: '<br><a href="trimdemo.php?demo=' + encodeURIComponent(fileMap[clientKey]['id']) + '&time=' + shot.time + '&before=9000&after=7000&prefix=' + encodeURIComponent((Math.round(shot.score * 1000) / 1000) + ' ') + '"><b>NS</b>@' + time + ' - ' + score + '/10</a>'});
            });
          }
          if ('bookmarks' in fileMap[clientKey]) {
            $.each(fileMap[clientKey]['bookmarks'], function(idx, bookmark) {
              if (bookmark.mark != "ns") {
                return;
              }
              var time = formatTime(bookmark.time);
              extralinks.push({time: bookmark.time, link: '<br><a href="trimdemo.php?demo=' + encodeURIComponent(fileMap[clientKey]['id']) + '&time=' + bookmark.time + '&before=9000&after=7000&prefix=' + encodeURIComponent(bookmark.mark + ' ') + '"><b>NS</b>@' + time + ' - manual</a>'});
            });
          }
          extralinks.sort(function(left, right) { return right.time - left.time; });
          demolink += extralinks.map(function(link) { return link.link; }).join("");
        } else if (demo['demos'].length > 0 && player['team'] != 'SPECTATOR') {
          demolink = '<a style="color:#888888;" href="mergedemo.php?matchid=' + encodeURIComponent(demo['_id']) + '&clientid=' + player['client'] + '">Link</a>';
        }
        players[player['team'].toLowerCase()].push([
          demolink,
          player['time'],
          playerName,
          player['score'],
          player['ping'],
        ]);
      };
    };
    $.each(['redplayers', 'blueplayers', 'freeplayers', 'specplayers'], function(_, team) {
      if (team in scores) {
        $.each(scores[team], playerbuilder);
      }
    });
    var missingplayers = {}
    var playerchecker = function(_, player) {
      if ((player['client'] in playerdedup)) {
        return;
      }
      if (player['client'] in missingplayers) {
        var curtime = missingplayers[player['client']]['time'];
        var newtime = player['time'];
        if (newtime <= curtime) {
          return;
        }
      }
      missingplayers[player['client']] = player;
    };
    $.each(demo['scores'], function(idx, scores) {
      $.each(['redplayers', 'blueplayers', 'freeplayers', 'specplayers'], function(_, team) {
        if (team in scores) {
          $.each(scores[team], playerchecker);
        }
      });
    });
    $.each(demo['demos'], function(idx, curdemo) {
      if (curdemo['client_id'] in playerdedup) {
        return;
      }
      if (curdemo['client_id'] in missingplayers) {
        return;
      }
      missingplayers[curdemo['client_id']] = {
        'client': curdemo['client_id'],
        'client_name': curdemo['name'],
        'score': '?',
        'ping': '?',
        'time': '?',
        'team': 'SPECTATOR',
      };
      console.log(curdemo);
    });
    var teamspacers = {};
    $.each(missingplayers, function(client, player) {
      if (!(player['team'] in teamspacers)) {
        teamspacers[player['team']] = true;
        players[player['team'].toLowerCase()].push([
          "",
          "",
          "Disconnected Players:",
          "",
          "",
        ]);
      }
      playerbuilder(null, player);
    });
  }
  allmapcells.push({'players': players, 'teamScores': teamScores});
  var redscore = '';
  var bluescore = '';

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
    var cellstr = cells[i];
    var cell = $('<td>').attr('rowspan', totalRows(allmapcells));
    if (cellstr == '{{SCORES}}') {
      var root = $('<div>').attr('style', 'position:relative;');
      var levelshot = $('<img>').attr('alt', demo['mapname']).attr('src', '/maps/' + demo['mapname'].replaceAll('/', '').replace('ã', 'a').toLowerCase() + '.jpg').attr('width', 640).attr('height', 480);
      root.append(levelshot);
      var mapname = $('<div>').attr('style', 'position:absolute; bottom:0; width:320px; color:white; text-shadow: 2px 2px 4px #000000;').text(demo['mapname']);
      root.append(mapname);
      var sbroot = $('<div>').attr('style', 'position:absolute; top:100; width:640px; color: white;');
      root.append(sbroot);
      var sbtable = $('<table>').attr('style', 'color: white; text-shadow: 1px 1px 2px rgba(34, 34, 34, 1);');
      sbroot.append(sbtable);
      var header = $('<tr>');
      sbtable.append(header);
      header.append($('<td>').attr('width', '5%').attr('style', 'height: 30px;'));
      header.append($('<td>').attr('width', '8%').text('Time'));
      header.append($('<td>').attr('width', '8%').text('Ping'));
      header.append($('<td>').attr('width', '10%').text('Score'));
      header.append($('<td>').attr('width', '20%').text('Name'));

      header.append($('<td>').attr('width', '3%'));

      header.append($('<td>').attr('width', '8%').text('Time'));
      header.append($('<td>').attr('width', '8%').text('Ping'));
      header.append($('<td>').attr('width', '10%').text('Score'));
      header.append($('<td>').attr('width', '20%').text('Name'));
      header.append($('<td>').attr('width', '5%'));
      var teamheader = $('<tr>');
      sbtable.append(teamheader);
      var rule = 'border-bottom: 1px solid rgba(169, 169, 169, 1);';
      teamheader.append($('<td>'));
      teamheader.append($('<td>').attr('style', rule));
      var redbg = 'background-color: rgba(255, 51, 51, 0.33);';
      teamheader.append($('<td>').attr('style', redbg + rule).text('72'));
      teamheader.append($('<td>').attr('style', redbg + rule).text(teamScores[0]));
      teamheader.append($('<td>').attr('style', rule + 'color:rgba(255, 51, 51, 1); text-align:center;').text('Red Team'));

      teamheader.append($('<td>'));

      teamheader.append($('<td>').attr('style', rule));
      var bluebg = 'background-color: rgba(51, 51, 255, 0.33);';
      teamheader.append($('<td>').attr('style', bluebg + rule).text('72'));
      teamheader.append($('<td>').attr('style', bluebg + rule).text(teamScores[1]));
      teamheader.append($('<td>').attr('style', rule + 'color:rgba(51, 51, 255, 1); text-align:center;').text('Blue Team'));
      teamheader.append($('<td>'));
      var players = allmapcells[0]['players'];
      for (var j = 0; j < maxScoreRows(players); j++) {
        var playerrow = $('<tr>');
        sbtable.append(playerrow);
        for (var key of ['red', 'blue']) {//players) {
          var player = ['', '', '', '', ''];
          if (players[key].length > j) {
            player = players[key][j];
          }
          var bg;
          var name = player[2];
          var rmatch = name.match(/\(.* - .*\)$/);
          if (rmatch) {
            name = name.substring(0, rmatch.index);
          }
          if (key == 'red') {
            player = [player[0], player[1], player[4], player[3], name];
            bg = redbg;
          } else {
            player = ['', player[1], player[4], player[3], name, player[0]];
            bg = bluebg;
          }
          $.each(player, function(idx, text) {
            var playercell = $('<td>').html(text);
            if (idx > 0 && idx < 4) {
              playercell.attr('style', bg);
            }
            playerrow.append(playercell);
          });
        }
      }
      /*
      '<tr><td></td><td style="background-color: rgba(255, 51, 51, 0.33);">20</td><td style="background-color: rgba(255, 51, 51, 0.33);">59</td><td style="background-color: rgba(255, 51, 51, 0.33);">519</td><td>teh</td></tr>' +
      '</table></div>' +
      '</div>';*/
      cell.append(root);
    } else {
      cell.html(cellstr);
    }
    row.append(cell);
  }
  var rowWritten = false;
  var rowStyles = ['', 'background-color:#e0e0e0'];
  var rowCount = 0;
  for (var i = 0; i < allmapcells.length; i++) {
    var style = rowStyles[(offset + i) % 2];
    rowWritten = false;
    var players = allmapcells[i]['players'];
    var teamScores = allmapcells[i]['teamScores'];
    {
      for (var j = 0; j < 4; j++) {
        row.append($('<td>' + teamScores[j] + '</td>').attr('colspan', 5).attr('style', style));
      }
      $('#recentdemos tr:last').after(row);
      rowWritten = true;
      row = $('<tr>');
    }
    for (var j = 0; j < maxScoreRows(players); j++) {
      for (var key in players) {
        var player = ['', '', '', '', ''];
        if (players[key].length > j) {
          player = players[key][j];
        }
        $.each(player, function(idx, text) {
          row.append($('<td>' + text + '</td>').attr('style', style));
        });
      }
      $('#recentdemos > tbody > tr').last().after(row);
      rowWritten = true;
      row = $('<tr>');
    }
    if (!rowWritten) {
      $('#recentdemos > tbody > tr').last().after(row);
      rowWritten = true;
    }
    row = $('<tr>');
  }
  if (!rowWritten) {
    $('#recentdemos > tbody > tr').last().after(row);
  }
  return offset + allmapcells.length;
}

function writePagination(rpc, count, curOffset, limit)
{
  curOffset -= curOffset % limit;
  if (typeof count === 'undefined' || isNaN(count)) {
    count = curOffset + limit;
  }
  //console.log("pagingation for " + count + ", " + curOffset + ", " + limit);
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
  for (; offset < count && offset <= curOffset + limit; offset += limit, numLinks++) {
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
  var hashdata = {'rpc': 'recentDemos', 'offset': offset, 'limit': limit};
  window.location.hash = $.param(hashdata);
  var data = { 'offset': offset, 'limit': limit };
  rpc('recentmatches', data, function(response) {
    $('#searchresult').text('Recent matches:');
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
    'Demo',
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
  $('form#search').attr('onSubmit', 'search(0, 5); return false;');
  // for initializing elements on the page, the rpcs should be done on page load as jsonp instead of async
  $('#numdemos').text('' + numdemos['numdemos']);
  // check if we should be loading the data via hash instead of the default data
  var hashRendered = false;
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), false);
    var rpcname = hashdata['rpc'];
    hashRendered = true;
    if (rpcname == 'search') {
      if ('player' in hashdata) {
        $('input[name="player"]').val(hashdata['player']);
      }
      if ('before' in hashdata) {
        $('input[name="before"]').val(hashdata['before']);
      }
      if ('map' in hashdata) {
        $('input[name="map"]').val(hashdata['map']);
      }
      if ('server' in hashdata) {
        $('input[name="server"]').val(hashdata['server']);
      }
      if ('match' in hashdata) {
        $('input[name="match"]').prop('checked', hashdata['match'] === 'true');
      }
      search(hashdata['offset'], hashdata['limit']);
    } else if (rpcname == 'recentDemos') {
      recentDemos(hashdata['offset'], hashdata['limit']);
    } else if (rpcname == 'lookup') {
      lookup(hashdata['id']);
    } else {
      hashRendered = false;
    }
  }
  if (!hashRendered) {
    var offset = 0;
    for (var idx = 0; idx < recentmatches.result.length; idx++) {
      offset = writeDemoRow(recentmatches.result[idx], true, offset);
    }
    writePagination(recentDemos, parseInt(recentmatches.total), parseInt(recentmatches.offset), parseInt(recentmatches.limit));
  }
  $('input[name="player"]').autocomplete({
    //source: topnames,
    source: matchColorInsensitive(topnames),
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
    source: matchColorInsensitive(topservers),
    minLength: 1
  });
})
